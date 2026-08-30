import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import {
  fromISODate,
  isValidDeliveryDate,
  nextSubscriptionDate,
  toISODate,
  todayInStockholm,
  addDays,
} from "@/lib/dates";
import type { SubscriptionInput } from "@/lib/validation";
import type { SubscriptionFrequency } from "@/lib/status";
import { createOrder, OrderError } from "@/lib/orders/create-order";

// Prenumeration = återkommande order/fakturering — INTE kortdebitering.
// Motorn genererar vanliga ordrar via samma ordermotor som engångsköp.

export async function createSubscription(input: SubscriptionInput) {
  // Idempotens: dubbelklick/nätverksretry returnerar den befintliga
  // prenumerationen istället för att starta en till (unikt villkor i DB).
  if (input.idempotencyKey) {
    const existing = await prisma.subscription.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) return existing;
  }

  const area = await prisma.deliveryArea.findUnique({ where: { slug: input.areaSlug } });
  if (!area || !area.active) throw new OrderError("Okänt leveransområde", "areaSlug");
  const areaId = area.id;

  // Samma postnummerspärr som checkouten — annars startas prenumerationer
  // som ordergenereringen sedan inte kan leverera.
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

  const firstDate = fromISODate(input.firstDeliveryDate);
  const areaConfig = {
    weekdays: JSON.parse(area.weekdaysJson) as number[],
    leadTimeDays: area.leadTimeDays,
  };
  if (!isValidDeliveryDate(firstDate, areaConfig)) {
    throw new OrderError("Leveransdagen är inte tillgänglig — välj en ny dag", "firstDeliveryDate");
  }

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, active: true },
  });
  if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
    throw new OrderError("En produkt i prenumerationen finns inte längre", "items");
  }

  try {
    return await runCreate();
  } catch (e) {
    // Kapplöpning på idempotensnyckeln: parallell förfrågan hann först.
    if (
      input.idempotencyKey &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      (e.meta?.target as string[] | undefined)?.includes?.("idempotencyKey")
    ) {
      const existing = await prisma.subscription.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }
    throw e;
  }

  function runCreate() {
    return prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, "subscription");
      return tx.subscription.create({
        data: {
          number,
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
          deliveryAreaId: areaId,
          invoiceEmail: input.invoiceEmail,
          reference: input.reference,
          frequency: input.frequency,
          nextDeliveryDate: firstDate,
          items: {
            create: input.items.map((i) => ({ productId: i.productId, weightKg: i.weightKg })),
          },
        },
        include: { items: true },
      });
    });
  }
}

function safeParseStringArray(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.length > 0) : [];
  } catch {
    return [];
  }
}

export interface GenerationResult {
  generated: { subscriptionNumber: string; orderNumber: string; deliveryDate: string }[];
  skipped: { subscriptionNumber: string; reason: string }[];
}

/**
 * Genererar ordrar för alla aktiva prenumerationer vars nästa leveransdatum
 * ligger inom horisonten. Idempotent: unikhetsvillkoret
 * (subscriptionId, subscriptionPeriod) i databasen garanterar att samma
 * period aldrig ger två ordrar, även vid samtidiga körningar eller retry.
 */
export async function generateDueSubscriptionOrders(
  options: { horizonDays?: number; now?: Date; skipEmails?: boolean } = {}
): Promise<GenerationResult> {
  const now = options.now ?? new Date();
  const today = todayInStockholm(now);
  const horizon = addDays(today, options.horizonDays ?? 3);

  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextDeliveryDate: { lte: horizon } },
    include: { items: { include: { product: true } }, deliveryArea: true },
  });

  const result: GenerationResult = { generated: [], skipped: [] };

  for (const sub of due) {
    const period = toISODate(sub.nextDeliveryDate);
    const area = sub.deliveryArea;
    if (!area) {
      result.skipped.push({ subscriptionNumber: sub.number, reason: "Leveransområde saknas" });
      continue;
    }

    // Passerat datum (t.ex. paus som släppts efter lång tid): skapa ingen
    // bakdaterad order — flytta fram till nästa giltiga dag och fortsätt där.
    if (sub.nextDeliveryDate.getTime() < today.getTime()) {
      const areaConfig = {
        weekdays: JSON.parse(area.weekdaysJson) as number[],
        leadTimeDays: area.leadTimeDays,
      };
      let next = sub.nextDeliveryDate;
      for (let i = 0; i < 60 && next.getTime() < today.getTime(); i++) {
        next = nextSubscriptionDate(next, sub.frequency as SubscriptionFrequency, areaConfig);
      }
      await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: next } });
      result.skipped.push({
        subscriptionNumber: sub.number,
        reason: `Passerat datum ${period} — framflyttad till ${toISODate(next)}`,
      });
      continue;
    }
    const activeItems = sub.items.filter((i) => i.product.active && i.weightKg > 0);
    if (activeItems.length === 0) {
      result.skipped.push({ subscriptionNumber: sub.number, reason: "Inga aktiva produkter" });
      continue;
    }

    try {
      const { order } = await createOrder(
        {
          items: activeItems.map((i) => ({ productId: i.productId, weightKg: i.weightKg })),
          areaSlug: area.slug,
          deliveryDate: period,
          companyName: sub.companyName,
          orgNumber: sub.orgNumber,
          contactName: sub.contactName,
          email: sub.email,
          phone: sub.phone || "-",
          deliveryAddress: sub.deliveryAddress,
          deliveryPostalCode: sub.deliveryPostalCode,
          deliveryCity: sub.deliveryCity,
          deliveryInstruction: sub.deliveryInstruction,
          invoiceEmail: sub.invoiceEmail,
          reference: sub.reference,
          billingAddress: "",
        },
        { subscription: { id: sub.id, period }, skipEmails: options.skipEmails }
      );
      result.generated.push({
        subscriptionNumber: sub.number,
        orderNumber: order.orderNumber,
        deliveryDate: period,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        (e.meta?.target as string[] | undefined)?.includes?.("subscriptionId")
      ) {
        // Ordern för perioden finns redan (retry/dubbelkörning) — hoppa vidare.
        result.skipped.push({ subscriptionNumber: sub.number, reason: `Period ${period} redan genererad` });
      } else {
        result.skipped.push({
          subscriptionNumber: sub.number,
          reason: e instanceof Error ? e.message : "Okänt fel",
        });
        continue; // flytta INTE fram datumet vid riktiga fel
      }
    }

    // Flytta fram nästa leveransdatum (även när perioden redan var genererad).
    const areaConfig = {
      weekdays: JSON.parse(area.weekdaysJson) as number[],
      leadTimeDays: area.leadTimeDays,
    };
    const next = nextSubscriptionDate(
      sub.nextDeliveryDate,
      sub.frequency as SubscriptionFrequency,
      areaConfig
    );
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextDeliveryDate: next },
    });
  }

  return result;
}
