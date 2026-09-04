import { cache } from "react";
import { prisma } from "@/lib/db";
import type { ProductCardData } from "@/components/ProductCard";

export const getActiveProducts = cache(async function getActiveProducts(): Promise<ProductCardData[]> {
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
    vatRateBp: p.vatRateBp,
  }));
});

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
  /** Datum admin spärrat (ISO). Helgdagar räknas bort automatiskt i dates.ts. */
  blockedDates: string[];
  /** Datum där kapacitetstaket redan är nått — visas inte i kassan. */
  fullDates: string[];
  upcomingDates: string[]; // ISO-datum
}

import { toISODate, upcomingDeliveryDates, weekdayName } from "@/lib/dates";
import { bookedKgByDate } from "@/lib/orders/capacity";

export const getAreasWithDates = cache(async function getAreasWithDates(dateCount = 4): Promise<AreaWithDates[]> {
  const areas = await prisma.deliveryArea.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return Promise.all(
    areas.map(async (a) => {
      const weekdays = safeWeekdays(a.weekdaysJson);
      const blockedDates = safeBlockedDates(a.blockedDatesJson);
      // Fulla dagar: hämta fler kandidater än vi visar, så listan inte krymper
      // när en dag faller bort.
      let fullDates: string[] = [];
      if (a.maxKgPerDay > 0) {
        const candidates = upcomingDeliveryDates({ weekdays, leadTimeDays: a.leadTimeDays, blockedDates }, dateCount + 4).map(toISODate);
        const booked = await bookedKgByDate(a.id, candidates);
        fullDates = candidates.filter((d) => (booked.get(d) ?? 0) >= a.maxKgPerDay);
      }
      const config = { weekdays, leadTimeDays: a.leadTimeDays, blockedDates: [...blockedDates, ...fullDates] };
      return {
        slug: a.slug,
        name: a.name,
        weekdays,
        leadTimeDays: a.leadTimeDays,
        blockedDates,
        fullDates,
        upcomingDates: upcomingDeliveryDates(config, dateCount).map(toISODate),
      };
    })
  );
});

/** Spärrade datum från admin — bara giltiga ISO-datum släpps igenom. */
export function safeBlockedDates(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)) : [];
  } catch {
    return [];
  }
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
// React.cache: samma request anropar detta från hero, footer och sida — en DB-fråga, inte tre.
export const getDeliveryDaysLabel = cache(async function getDeliveryDaysLabel(): Promise<string> {
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
});
