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
  const area = await prisma.deliveryArea.findUnique({ where: { slug: input.areaSlug } });
  if (!area || !area.active) throw new OrderError("Okänt leveransområde", "areaSlug");

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

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, "subscription");
    return tx.subscription.create({
      data: {
        number,
        companyName: input.companyName,
        orgNumber: input.orgNumber,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        deliveryAddress: input.deliveryAddress,
        deliveryPostalCode: input.deliveryPostalCode,
        deliveryCity: input.deliveryCity,
        deliveryInstruction: input.deliveryInstruction,
        deliveryAreaId: area.id,
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
  const horizon = addDays(todayInStockholm(now), options.horizonDays ?? 3);

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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
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
