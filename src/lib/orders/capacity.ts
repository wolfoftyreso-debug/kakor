import { prisma } from "@/lib/db";
import { fromISODate, nextCadenceDate, snapToDeliveryWeekday, toISODate, todayInStockholm, type DeliveryDayConfig } from "@/lib/dates";
import { safeBlockedDates, safeWeekdays } from "@/lib/products";

// Kapacitet per leveransdag räknas i kilo: lösvikt rakt av, paket via
// paketvikten. Priset påverkas aldrig – det här är packvolym.

export interface KgLine {
  weightKg: number;
  unit: string;
  packageWeightGrams?: number | null;
}

export function lineKg(line: KgLine): number {
  if (line.unit === "paket") return (line.weightKg * (line.packageWeightGrams ?? 0)) / 1000;
  return line.weightKg;
}

export function totalKg(lines: KgLine[]): number {
  return Math.round(lines.reduce((s, l) => s + lineKg(l), 0) * 100) / 100;
}

/**
 * Bokade kilo per ISO-datum i ett område. Alla ej avbrutna ordrar räknas –
 * även levererade, eftersom dagens kapacitet är det som packas den dagen.
 * `client` kan vara en transaktion (kapacitetskontroll under radlås).
 */
export type CapacityClient = Pick<typeof prisma, "order" | "subscription">;

/**
 * Prenumerationsvolym som ännu inte blivit order. Prenumerationsordrar skapas
 * bara några dagar före leverans och går förbi kapacitetstaket – utan den här
 * reservationen kan engångskunder fylla dagen först, och packdagen blir översåld.
 * Perioder som redan har en order räknas inte (de ligger bland ordrarna).
 */
export async function projectedSubscriptionKgByDate(
  areaId: string,
  isoDates: string[],
  client: CapacityClient = prisma
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (isoDates.length === 0) return out;
  const wanted = new Set(isoDates);
  const last = fromISODate([...isoDates].sort().at(-1)!);
  const subs = await client.subscription.findMany({
    where: { deliveryAreaId: areaId, status: "ACTIVE", nextDeliveryDate: { lte: last } },
    select: {
      frequency: true,
      nextDeliveryDate: true,
      deliveryArea: { select: { weekdaysJson: true, leadTimeDays: true, blockedDatesJson: true } },
      items: { select: { weightKg: true, product: { select: { unit: true, packageWeightGrams: true, active: true } } } },
      orders: { where: { status: { not: "CANCELLED" } }, select: { subscriptionPeriod: true } },
    },
  });
  const today = todayInStockholm();
  for (const sub of subs) {
    if (!sub.deliveryArea) continue;
    const config: DeliveryDayConfig = {
      weekdays: safeWeekdays(sub.deliveryArea.weekdaysJson),
      leadTimeDays: sub.deliveryArea.leadTimeDays,
      blockedDates: safeBlockedDates(sub.deliveryArea.blockedDatesJson),
    };
    const kg = totalKg(
      sub.items
        .filter((i) => i.product.active)
        .map((i) => ({ weightKg: i.weightKg, unit: i.product.unit, packageWeightGrams: i.product.packageWeightGrams }))
    );
    if (kg <= 0) continue;
    const generated = new Set(sub.orders.map((o) => o.subscriptionPeriod).filter(Boolean));
    let cadence = sub.nextDeliveryDate;
    for (let i = 0; i < 60 && cadence.getTime() <= last.getTime(); i++) {
      const delivery = snapToDeliveryWeekday(cadence, config);
      const iso = toISODate(delivery);
      if (delivery.getTime() >= today.getTime() && wanted.has(iso) && !generated.has(iso)) {
        out.set(iso, Math.round(((out.get(iso) ?? 0) + kg) * 100) / 100);
      }
      cadence = nextCadenceDate(cadence, sub.frequency as "WEEKLY" | "BIWEEKLY" | "MONTHLY", config.weekdays);
    }
  }
  return out;
}

export async function bookedKgByDate(
  areaId: string,
  isoDates: string[],
  client: CapacityClient = prisma
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (isoDates.length === 0) return out;
  const projected = await projectedSubscriptionKgByDate(areaId, isoDates, client);
  for (const [k, v] of projected) out.set(k, v);
  const orders = await client.order.findMany({
    where: {
      deliveryAreaId: areaId,
      status: { not: "CANCELLED" },
      deliveryDate: { in: isoDates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
    },
    select: {
      deliveryDate: true,
      items: { select: { weightKg: true, unit: true, packageWeightGrams: true, product: { select: { packageWeightGrams: true } } } },
    },
  });
  for (const o of orders) {
    const key = o.deliveryDate.toISOString().slice(0, 10);
    const kg = totalKg(o.items.map((i) => ({ weightKg: i.weightKg, unit: i.unit, packageWeightGrams: i.packageWeightGrams || i.product?.packageWeightGrams })));
    out.set(key, Math.round(((out.get(key) ?? 0) + kg) * 100) / 100);
  }
  return out;
}
