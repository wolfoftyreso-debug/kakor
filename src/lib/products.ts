import { cache } from "react";
import { unstable_cache } from "next/cache";
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
    piecesPerKgApprox: p.piecesPerKgApprox ?? null,
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
  /** Datum där kapacitetstaket redan är nått – visas inte i kassan. */
  fullDates: string[];
  /** Postnummerprefix (tom = ingen spärr) – kassan varnar direkt i steg 3. */
  postalPrefixes: string[];
  upcomingDates: string[]; // ISO-datum
  /** Kundtext när närmaste leveransdagen stängts av onsdagscutoff. */
  cutoffNotice: string | null;
  cutoffWeekday: number;
  cutoffHour: number;
}

import { toISODate, upcomingDeliveryDates, weekdayName, fromISODate } from "@/lib/dates";
import { bookedKgByDate } from "@/lib/orders/capacity";
import { cutoffClosedMessage } from "@/lib/warehouse/cutoff";
import { getWarehouseClosedDates } from "@/lib/warehouse/closed";
import { getOpsSettings } from "@/lib/warehouse/settings";

export const getAreasWithDates = cache(async function getAreasWithDates(dateCount = 4): Promise<AreaWithDates[]> {
  const areas = await prisma.deliveryArea.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  let warehouseClosed = new Set<string>();
  let cutoffWeekday = 3;
  let cutoffHour = 12;
  try {
    warehouseClosed = await getWarehouseClosedDates();
    const ops = await getOpsSettings();
    cutoffWeekday = ops.cutoffWeekday;
    cutoffHour = ops.cutoffHour;
  } catch {
    warehouseClosed = new Set();
  }
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
      const warehouseClosedList = [...warehouseClosed];
      const config = { weekdays, leadTimeDays: a.leadTimeDays, blockedDates: [...blockedDates, ...fullDates, ...warehouseClosedList] };
      const upcoming = upcomingDeliveryDates(config, dateCount).map(toISODate);
      const natural = upcomingDeliveryDates({ weekdays, leadTimeDays: a.leadTimeDays, blockedDates: [...blockedDates, ...fullDates] }, dateCount + 4);
      const firstNatural = natural[0];
      let cutoffNotice: string | null = null;
      if (firstNatural && warehouseClosed.has(toISODate(firstNatural)) && upcoming[0]) {
        cutoffNotice = cutoffClosedMessage(firstNatural, fromISODate(upcoming[0]));
      }
      return {
        slug: a.slug,
        name: a.name,
        weekdays,
        leadTimeDays: a.leadTimeDays,
        blockedDates: [...blockedDates, ...warehouseClosedList],
        fullDates,
        postalPrefixes: safeStringList(a.postalCodePrefixesJson),
        upcomingDates: upcoming,
        cutoffNotice,
        cutoffWeekday,
        cutoffHour,
      };
    })
  );
});

function safeStringList(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.length > 0) : [];
  } catch {
    return [];
  }
}

/** Spärrade datum från admin – bara giltiga ISO-datum släpps igenom. */
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
 * "torsdagar" / "tisdagar och torsdagar" – unionen av alla aktiva områdens
 * leveransveckodagar, för publik copy (t.ex. footern). Tom sträng om
 * inget område har dagar konfigurerade. Leveransdagar är data, aldrig
 * hårdkodad text.
 */
async function loadDeliveryDaysLabel(): Promise<string> {
  // Footern ligger på varje sida – ett databasfel här får aldrig fälla sidan.
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

const cachedDeliveryDaysLabel = unstable_cache(loadDeliveryDaysLabel, ["delivery-days-label"], {
  revalidate: 300,
  tags: ["delivery-days"],
});

// React.cache: samma request anropar detta från hero, footer och sida – en DB-fråga, inte tre.
export const getDeliveryDaysLabel = cache(async function getDeliveryDaysLabel(): Promise<string> {
  return cachedDeliveryDaysLabel();
});

/** Postnummerprefix för aktiva leveransområden – används i Offer.shippingDestination. */
export const getDeliveryPostalPrefixes = cache(async function getDeliveryPostalPrefixes(): Promise<string[]> {
  try {
    const areas = await prisma.deliveryArea.findMany({
      where: { active: true },
      select: { postalCodePrefixesJson: true },
      orderBy: { sortOrder: "asc" },
    });
    return [...new Set(areas.flatMap((a) => safeStringList(a.postalCodePrefixesJson)))];
  } catch {
    return [];
  }
});
