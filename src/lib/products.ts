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
    weightOptions: safeWeights(p.weightOptionsJson),
    allergens: p.allergens,
    imageRef: p.imageRef,
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

import { toISODate, upcomingDeliveryDates } from "@/lib/dates";

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

function safeWeekdays(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      const w = arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
      if (w.length > 0) return w;
    }
  } catch {
    // fall igenom
  }
  return [2, 4];
}
