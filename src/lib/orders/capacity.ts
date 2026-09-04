import { prisma } from "@/lib/db";

// Kapacitet per leveransdag räknas i kilo: lösvikt rakt av, paket via
// paketvikten. Priset påverkas aldrig — det här är packvolym.

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

/** Bokade kilo per ISO-datum i ett område (ej avbrutna, ej levererade ordrar). */
export async function bookedKgByDate(areaId: string, isoDates: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (isoDates.length === 0) return out;
  const orders = await prisma.order.findMany({
    where: {
      deliveryAreaId: areaId,
      status: { not: "CANCELLED" },
      deliveryDate: { in: isoDates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
    },
    select: {
      deliveryDate: true,
      items: { select: { weightKg: true, unit: true, product: { select: { packageWeightGrams: true } } } },
    },
  });
  for (const o of orders) {
    const key = o.deliveryDate.toISOString().slice(0, 10);
    const kg = totalKg(o.items.map((i) => ({ weightKg: i.weightKg, unit: i.unit, packageWeightGrams: i.product?.packageWeightGrams })));
    out.set(key, Math.round(((out.get(key) ?? 0) + kg) * 100) / 100);
  }
  return out;
}
