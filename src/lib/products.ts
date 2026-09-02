import { prisma } from "@/lib/db";
import type { ProductCardData } from "@/components/ProductCard";

export async function getActiveProducts(): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    pricePerKgOre: p.pricePerKgOre,
    unit: p.unit,
    packageWeightGrams: p.packageWeightGrams,
    weightOptions: safeWeights(p.weightOptionsJson),
    allergens: p.allergens,
    imageRef: p.imageRef,
    badge: p.badge,
  }));
}

function safeWeights(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      const w = arr.filter((n) => Number.isInteger(n) && n > 0);
      if (w.length > 0) return w;
    }
  } catch {
    // fall igenom till default
  }
  return [1, 2, 3];
}

export interface AreaWithDates {
  slug: string;
  name: string;
  weekdays: number[];
  leadTimeDays: number;
  upcomingDates: string[]; // ISO-datum
}

import { toISODate, upcomingDeliveryDates, weekdayName } from "@/lib/dates";

export async function getAreasWithDates(dateCount = 4): Promise<AreaWithDates[]> {
  const areas = await prisma.deliveryArea.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return areas.map((a) => {
    const weekdays = safeWeekdays(a.weekdaysJson);
    return {
      slug: a.slug,
      name: a.name,
      weekdays,
      leadTimeDays: a.leadTimeDays,
      upcomingDates: upcomingDeliveryDates({ weekdays, leadTimeDays: a.leadTimeDays }, dateCount).map(
        toISODate
      ),
    };
  });
}

export function safeWeekdays(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      const w = arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
      if (w.length > 0) return w;
    }
  } catch {
    // fall igenom
  }
  return [4];
}

/**
 * "torsdagar" / "tisdagar och torsdagar" — unionen av alla aktiva områdens
 * leveransveckodagar, för publik copy (t.ex. footern). Tom sträng om
 * inget område har dagar konfigurerade. Leveransdagar är data, aldrig
 * hårdkodad text.
 */
export async function getDeliveryDaysLabel(): Promise<string> {
  // Footern ligger på varje sida — ett databasfel här får aldrig fälla sidan.
  let areas: { weekdaysJson: string }[] = [];
  try {
    areas = await prisma.deliveryArea.findMany({ where: { active: true }, select: { weekdaysJson: true } });
  } catch {
    return "";
  }
  const days = [...new Set(areas.flatMap((a) => safeWeekdays(a.weekdaysJson)))].sort((a, b) => a - b);
  const plural = days.map((d) => `${weekdayName(d)}ar`).filter((n) => n !== "ar");
  if (plural.length === 0) return "";
  if (plural.length === 1) return plural[0];
  return `${plural.slice(0, -1).join(", ")} och ${plural[plural.length - 1]}`;
}
