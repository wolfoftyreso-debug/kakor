import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calculateTotals } from "@/lib/money";
import { nextNumber } from "@/lib/numbering";
import { invoiceConfig } from "@/lib/config";
import { addDays, fromISODate, isValidDeliveryDate, toISODate, todayInStockholm } from "@/lib/dates";
import { safeWeekdays } from "@/lib/products";
import type { InvoiceSnapshot } from "@/lib/invoice/snapshot";
import type { CheckoutInput } from "@/lib/validation";
import { sendOrderEmails } from "@/lib/orders/order-emails";

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    /** Maskinläsbar kod för klienten, t.ex. PRICE_CHANGED / IDEMPOTENCY_MISMATCH / TOO_MANY. */
    public readonly code?: string
  ) {
    super(message);
  }
}

// Missbruksspärrar som håller över serverless-instanser: en publik endpoint
// som utfärdar löpnumrerade fakturor och mejlar dem får inte kunna användas
// som spam-/nätfiskerelä. Riktiga kunder når aldrig taken.
const ABUSE_WINDOW_MS = 24 * 3600_000;
export const ABUSE_LIMITS = { perEmail: 5, perOrgNumber: 10 } as const;

export async function assertNotAbusive(input: { email: string; invoiceEmail: string; orgNumber: string }) {
  const since = new Date(Date.now() - ABUSE_WINDOW_MS);
  const emails = [...new Set([input.email.toLowerCase(), input.invoiceEmail.toLowerCase()])];
  const [byEmail, byOrg] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: since },
        subscriptionId: null,
        OR: [{ email: { in: emails } }, { invoiceEmail: { in: emails } }],
      },
    }),
    prisma.order.count({
      where: { createdAt: { gte: since }, subscriptionId: null, orgNumber: input.orgNumber },
    }),
  ]);
  if (byEmail >= ABUSE_LIMITS.perEmail || byOrg >= ABUSE_LIMITS.perOrgNumber) {
    throw new OrderError(
      "Ni har redan lagt flera beställningar det senaste dygnet — svara på er senaste orderbekräftelse om ni vill lägga till mer.",
      undefined,
      "TOO_MANY"
    );
  }
}

/** Samma nyckel måste bära samma beställning — annars är det inte en retry. */
function sameOrderPayload(
  existing: { items: { productId: string | null; weightKg: number }[]; deliveryDate: Date; companyName: string; orgNumber: string; email: string; invoiceEmail: string; deliveryAddress: string; deliveryPostalCode: string },
  input: CheckoutInput
): boolean {
  const key = (items: { productId: string | null; weightKg: number }[]) =>
    items.map((i) => `${i.productId ?? ""}:${i.weightKg}`).sort().join("|");
  return (
    key(existing.items) === key(input.items) &&
    toISODate(existing.deliveryDate) === input.deliveryDate &&
    existing.companyName === input.companyName &&
    existing.orgNumber === input.orgNumber &&
    existing.email.toLowerCase() === input.email.toLowerCase() &&
    existing.invoiceEmail.toLowerCase() === input.invoiceEmail.toLowerCase() &&
    existing.deliveryAddress === input.deliveryAddress &&
    existing.deliveryPostalCode === input.deliveryPostalCode
  );
}

const IDEMPOTENCY_MISMATCH = () =>
  new OrderError(
    "Den här beställningen har redan skickats med andra uppgifter — ladda om sidan och försök igen.",
    undefined,
    "IDEMPOTENCY_MISMATCH"
  );

export interface CreateOrderOptions {
  /** Sätts för prenumerationsgenererade ordrar (idempotensnyckel). */
  subscription?: { id: string; period: string };
  /** Hoppa över e-post (t.ex. i tester). */
  skipEmails?: boolean;
}

/**
 * Skapar order + faktura atomiskt. Priser hämtas ALLTID från databasen —
 * klienten skickar bara produkt-id och vikt. E-post skickas efter commit;
 * misslyckad e-post påverkar aldrig ordern (order persistence först).
 */
export async function createOrder(input: CheckoutInput, options: CreateOrderOptions = {}) {
  // Idempotens: samma nyckel (dubbelklick/nätverksretry) returnerar befintlig order
  // istället för att skapa en dubblett.
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true, invoice: true },
    });
    if (existing && existing.invoice) {
      if (!sameOrderPayload(existing, input)) throw IDEMPOTENCY_MISMATCH();
      return { order: existing, invoice: existing.invoice, duplicate: true as const };
    }
  }

  if (!options.subscription) await assertNotAbusive(input);

  const area = await prisma.deliveryArea.findUnique({ where: { slug: input.areaSlug } });
  if (!area || !area.active) throw new OrderError("Okänt leveransområde", "areaSlug");
  const areaId = area.id;

  // Postnummerspärr (om konfigurerad för området): skapa inte ordrar som
  // verksamheten inte kan leverera.
  const prefixes = safeParseStringArray(area.postalCodePrefixesJson);
  if (prefixes.length > 0) {
    const compact = input.deliveryPostalCode.replace(/\s/g, "");
    if (!prefixes.some((p) => compact.startsWith(p.replace(/\s/g, "")))) {
      throw new OrderError(
        `Postnumret verkar inte ligga i ${area.name} — kontrollera adressen eller välj rätt område`,
        "deliveryPostalCode"
      );
    }
  }

  const deliveryDate = fromISODate(input.deliveryDate);
  const areaConfig = {
    weekdays: safeWeekdays(area.weekdaysJson),
    leadTimeDays: area.leadTimeDays,
  };
  // Prenumerationsordrar genereras i förväg av motorn och kan ligga närmare i
  // tiden än kundens cutoff — de datumvalideras vid prenumerationsstart istället.
  if (!options.subscription && !isValidDeliveryDate(deliveryDate, areaConfig)) {
    throw new OrderError("Leveransdagen är inte tillgänglig — välj en ny dag", "deliveryDate");
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines = input.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new OrderError("En produkt i beställningen finns inte längre", "items");
    // Vikten är medvetet INTE begränsad till weightOptionsJson: alternativen är
    // snabbval i UI:t, checkoutens stepper tillåter valfritt helt kilo.
    // Taken sätts av valideringen: 1–100 kg per rad, max 30 rader.
    return {
      productId: product.id,
      productName: product.name,
      weightKg: item.weightKg,
      unit: product.unit,
      unitPricePerKgOre: product.pricePerKgOre,
      vatRateBp: product.vatRateBp,
      lineTotalOre: item.weightKg * product.pricePerKgOre,
    };
  });

  const totals = calculateTotals(
    lines.map((l) => ({ netOre: l.lineTotalOre, vatRateBp: l.vatRateBp }))
  );
  if (input.expectedTotalOre !== undefined && input.expectedTotalOre !== totals.totalOre) {
    throw new OrderError(
      "Priset har uppdaterats sedan ni började beställa — kontrollera den nya summan och skicka igen.",
      undefined,
      "PRICE_CHANGED"
    );
  }

  // Svensk dag, inte UTC — en order kl 00–02 sommartid ska inte fakturadateras föregående dag.
  const invoiceDate = todayInStockholm();
  const dueDate = addDays(invoiceDate, invoiceConfig.paymentTermsDays);
  const downloadToken = randomBytes(24).toString("hex");

  let created: Awaited<ReturnType<typeof runCreateTransaction>>;
  try {
    created = await runCreateTransaction();
  } catch (e) {
    // Kapplöpning på idempotensnyckeln: en parallell förfrågan hann först —
    // returnera den order som redan skapades.
    if (
      input.idempotencyKey &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      (e.meta?.target as string[] | undefined)?.includes?.("idempotencyKey")
    ) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true, invoice: true },
      });
      if (existing && existing.invoice) {
        if (!sameOrderPayload(existing, input)) throw IDEMPOTENCY_MISMATCH();
        return { order: existing, invoice: existing.invoice, duplicate: true as const };
      }
    }
    throw e;
  }

  async function runCreateTransaction() {
    return prisma.$transaction(async (tx) => {
    const orderNumber = await nextNumber(tx, "order");
    const invoiceNumber = await nextNumber(tx, "invoice");

    const order = await tx.order.create({
      data: {
        orderNumber,
        idempotencyKey: input.idempotencyKey,
        companyName: input.companyName,
        orgNumber: input.orgNumber,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        deliveryAddress: input.deliveryAddress,
        deliveryPostalCode: input.deliveryPostalCode,
        deliveryCity: input.deliveryCity,
        deliveryInstruction: input.deliveryInstruction,
        deliveryDate,
        deliveryAreaId: areaId,
        invoiceEmail: input.invoiceEmail,
        reference: input.reference,
        billingAddress: input.billingAddress,
        subtotalOre: totals.subtotalOre,
        vatOre: totals.vatOre,
        totalOre: totals.totalOre,
        subscriptionId: options.subscription?.id,
        subscriptionPeriod: options.subscription?.period,
        items: { create: lines },
      },
      include: { items: true },
    });

    const snapshot: InvoiceSnapshot = {
      seller: {
        companyName: invoiceConfig.companyName,
        orgNumber: invoiceConfig.orgNumber,
        address: invoiceConfig.address,
        postalCode: invoiceConfig.postalCode,
        city: invoiceConfig.city,
        email: invoiceConfig.email,
        phone: invoiceConfig.phone,
        bankgiro: invoiceConfig.bankgiro,
        vatNumber: invoiceConfig.vatNumber,
        fSkatt: invoiceConfig.fSkatt,
      },
      buyer: {
        companyName: input.companyName,
        orgNumber: input.orgNumber,
        contactName: input.contactName,
        invoiceEmail: input.invoiceEmail,
        billingAddress:
          input.billingAddress ||
          `${input.deliveryAddress}, ${input.deliveryPostalCode} ${input.deliveryCity}`,
        reference: input.reference,
      },
      orderNumber,
      deliveryDate: toISODate(deliveryDate),
      lines: lines.map(({ productId: _productId, ...rest }) => rest),
      subtotalOre: totals.subtotalOre,
      vatOre: totals.vatOre,
      totalOre: totals.totalOre,
      currency: "SEK",
      invoiceDate: toISODate(invoiceDate),
      dueDate: toISODate(dueDate),
      paymentTermsDays: invoiceConfig.paymentTermsDays,
    };

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        invoiceDate,
        dueDate,
        snapshotJson: JSON.stringify(snapshot),
        subtotalOre: totals.subtotalOre,
        vatOre: totals.vatOre,
        totalOre: totals.totalOre,
        downloadToken,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "CREATED",
        message: options.subscription
          ? `Order skapad från prenumeration (period ${options.subscription.period}). Faktura ${invoiceNumber} utfärdad.`
          : `Order mottagen via webben. Faktura ${invoiceNumber} utfärdad.`,
      },
    });

      return { order, invoice };
    });
  }

  if (!options.skipEmails) {
    // Medvetet efter transaktionen: ordern är säkrad även om e-posten fallerar.
    await sendOrderEmails(created.order.id).catch((e) =>
      console.error("Ordermail misslyckades:", e)
    );
  }

  return { ...created, duplicate: false as const };
}

function safeParseStringArray(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.length > 0) : [];
  } catch {
    return [];
  }
}
