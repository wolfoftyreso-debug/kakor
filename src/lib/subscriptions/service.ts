import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import {
  fromISODate,
  isValidDeliveryDate,
  nextSubscriptionDate,
  snapToDeliveryWeekday,
  toISODate,
  todayInStockholm,
  addDays,
} from "@/lib/dates";
import type { SubscriptionInput } from "@/lib/validation";
import type { SubscriptionFrequency } from "@/lib/status";
import { safeBlockedDates, safeWeekdays } from "@/lib/products";
import { assertNotAbusive, createOrder, OrderError } from "@/lib/orders/create-order";

// Prenumeration = återkommande order/fakturering — INTE kortdebitering.
// Motorn genererar vanliga ordrar via samma ordermotor som engångsköp.

/** Samma nyckel måste bära samma prenumeration — annars är det inte en retry. */
function sameSubscriptionPayload(
  existing: { items: { productId: string; weightKg: number }[]; frequency: string; companyName: string; orgNumber: string; email: string; deliveryAddress: string },
  input: SubscriptionInput
): boolean {
  const key = (items: { productId: string; weightKg: number }[]) =>
    items.map((i) => `${i.productId}:${i.weightKg}`).sort().join("|");
  return (
    key(existing.items) === key(input.items) &&
    existing.frequency === input.frequency &&
    existing.companyName === input.companyName &&
    existing.orgNumber === input.orgNumber &&
    existing.email.toLowerCase() === input.email.toLowerCase() &&
    existing.deliveryAddress === input.deliveryAddress
  );
}

const IDEMPOTENCY_MISMATCH = () =>
  new OrderError(
    "Den här prenumerationen har redan skickats med andra uppgifter — ladda om sidan och försök igen.",
    undefined,
    "IDEMPOTENCY_MISMATCH"
  );

const SUBSCRIPTION_ABUSE_WINDOW_MS = 24 * 3600_000;

/**
 * Startar en prenumeration. `duplicate` = true när en befintlig prenumeration
 * returnerades för samma idempotensnyckel (då ska ingen ny bekräftelse mejlas).
 */
export async function createSubscription(input: SubscriptionInput) {
  // Idempotens: dubbelklick/nätverksretry returnerar den befintliga
  // prenumerationen istället för att starta en till (unikt villkor i DB).
  if (input.idempotencyKey) {
    const existing = await prisma.subscription.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) {
      if (!sameSubscriptionPayload(existing, input)) throw IDEMPOTENCY_MISMATCH();
      return { subscription: existing, duplicate: true as const };
    }
  }

  // Missbruksspärrar: samma dygnsgränser som checkouten, plus max två
  // prenumerationsstarter per e-post — cronen skulle annars generera
  // riktiga ordrar/fakturor för spam-prenumerationer tills admin stoppar dem.
  await assertNotAbusive(input);
  const recentSubs = await prisma.subscription.count({
    where: {
      createdAt: { gte: new Date(Date.now() - SUBSCRIPTION_ABUSE_WINDOW_MS) },
      status: { not: "CANCELLED" },
      email: input.email.toLowerCase(),
    },
  });
  if (recentSubs >= 3) {
    throw new OrderError(
      "Ni har redan startat en fikaprenumeration det senaste dygnet — svara på bekräftelsemejlet om ni vill ändra den.",
      undefined,
      "TOO_MANY"
    );
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
    weekdays: safeWeekdays(area.weekdaysJson),
    leadTimeDays: area.leadTimeDays,
    blockedDates: safeBlockedDates(area.blockedDatesJson),
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
    return { subscription: await runCreate(), duplicate: false as const };
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
      if (existing) {
        if (!sameSubscriptionPayload(existing, input)) throw IDEMPOTENCY_MISMATCH();
        return { subscription: existing, duplicate: true as const };
      }
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
    const area = sub.deliveryArea;
    if (!area || !area.active) {
      // Inaktiverat område: hoppa över med tydlig orsak i stället för att
      // låta createOrder kasta samma fel varje dag.
      result.skipped.push({
        subscriptionNumber: sub.number,
        reason: area ? `Leveransområdet ${area.name} är inaktiverat — prenumerationen behöver ses över i admin` : "Leveransområde saknas",
      });
      continue;
    }
    const frequency = sub.frequency as SubscriptionFrequency;
    const areaConfig = {
      weekdays: safeWeekdays(area.weekdaysJson),
      leadTimeDays: area.leadTimeDays,
      blockedDates: safeBlockedDates(area.blockedDatesJson),
    };

    // 1) Passerat datum eller "idag" (t.ex. paus som släppts sent): skapa
    //    aldrig en order för leverans samma dag — den hinner inte packas.
    //    Gränsen är i morgon, inte kundens framförhållning: en missad
    //    cron-körning ska inte skjuta en redan planerad leverans en hel period.
    const earliest = addDays(today, 1);
    let deliveryDate = sub.nextDeliveryDate;
    let moved = false;
    for (let i = 0; i < 60 && deliveryDate.getTime() < earliest.getTime(); i++) {
      deliveryDate = nextSubscriptionDate(deliveryDate, frequency, areaConfig);
      moved = true;
    }
    // 2) Områdets leveransdagar kan ha ändrats sedan datumet sattes (t.ex.
    //    tisdag+torsdag -> endast torsdag): snäpp till närmaste giltiga dag.
    const snapped = snapToDeliveryWeekday(deliveryDate, areaConfig);
    if (snapped.getTime() !== deliveryDate.getTime()) {
      deliveryDate = snapped;
      moved = true;
    }
    // Vakt: har prenumerationen legat pausad längre än loopen når (60 × intervall)
    // får ALDRIG en bakdaterad order skapas — hoppa över och låt nästa körning
    // fortsätta framflyttningen från det sparade datumet.
    if (deliveryDate.getTime() < earliest.getTime()) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: deliveryDate } });
      result.skipped.push({
        subscriptionNumber: sub.number,
        reason: `Passerat datum ${toISODate(sub.nextDeliveryDate)} — flyttas fram stegvis (nu ${toISODate(deliveryDate)})`,
      });
      continue;
    }
    if (moved) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: deliveryDate } });
    }
    // 3) Hamnar det framflyttade datumet utanför horisonten genereras det vid
    //    en senare körning — men ligger det inom horisonten skapas ordern NU
    //    (tidigare tappades leveransen om framflyttningen landade på "idag").
    if (deliveryDate.getTime() > horizon.getTime()) {
      result.skipped.push({
        subscriptionNumber: sub.number,
        reason: `Passerat datum ${toISODate(sub.nextDeliveryDate)} — framflyttad till ${toISODate(deliveryDate)}`,
      });
      continue;
    }
    const period = toISODate(deliveryDate);

    const activeItems = sub.items.filter((i) => i.product.active && i.weightKg > 0);
    const droppedItems = sub.items.filter((i) => !i.product.active && i.weightKg > 0);
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
          phone: sub.phone,
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
      if (droppedItems.length > 0) {
        // Kunden faktureras för färre varor än avtalat — synligt i orderns
        // historik så att verksamheten kan meddela kunden.
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "NOTE",
            message: `OBS: ${droppedItems.map((i) => i.product.name).join(", ")} ingår inte i leveransen — produkten är inaktiverad. Meddela kunden.`,
            actor: "system",
          },
        });
      }
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        (e.meta?.target as string[] | undefined)?.includes?.("subscriptionId")
      ) {
        // Ordern för perioden finns redan (retry/dubbelkörning) — hoppa vidare.
        result.skipped.push({ subscriptionNumber: sub.number, reason: `Period ${period} redan genererad` });
      } else {
        const reason = e instanceof Error ? e.message : "Okänt fel";
        result.skipped.push({ subscriptionNumber: sub.number, reason });
        // Riktiga fel (inaktivt område, spärrat postnummer …) ska synas för
        // verksamheten — inte bara ligga i ett cron-svar ingen läser.
        console.error(`[prenumeration] ${sub.number} kunde inte generera order för ${period}: ${reason}`);
        continue; // flytta INTE fram datumet vid riktiga fel
      }
    }

    // Flytta fram nästa leveransdatum (även när perioden redan var genererad).
    const next = nextSubscriptionDate(deliveryDate, frequency, areaConfig);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextDeliveryDate: next },
    });
  }

  return result;
}
