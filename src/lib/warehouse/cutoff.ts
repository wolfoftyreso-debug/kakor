import {
  addDays,
  formatDeliveryDate,
  isoWeekday,
  isSwedishHoliday,
  stockholmTime,
  todayInStockholm,
  toISODate,
  weekdayGenitive,
  weekdayName,
} from "@/lib/dates";
import type { OpsSettings } from "./types";

/**
 * Cutoff för en leveransdag: senaste förekomsten av cutoff-veckodagen
 * (t.ex. onsdag) kl. cutoffHour svensk tid, strikt före leveransdagen.
 * Torsdag → onsdagen samma vecka. Tisdag → onsdagen veckan innan.
 */
export function cutoffForDelivery(deliveryDate: Date, settings: OpsSettings): Date {
  const weekday = clampWeekday(settings.cutoffWeekday);
  const hour = clampHour(settings.cutoffHour);
  let cursor = deliveryDate;
  for (let i = 0; i < 8; i++) {
    cursor = addDays(cursor, -1);
    if (isoWeekday(cursor) === weekday) return stockholmTime(cursor, hour);
  }
  return stockholmTime(addDays(deliveryDate, -1), hour);
}

export function isPastCutoff(deliveryDate: Date, settings: OpsSettings, now = new Date()): boolean {
  return now.getTime() >= cutoffForDelivery(deliveryDate, settings).getTime();
}

/** "Beställningar för torsdagens leverans är nu stängda. Din nästa möjliga leverans är torsdag 17 september." */
export function cutoffClosedMessage(closedDate: Date, nextOpenDate: Date): string {
  const gen = weekdayGenitive(isoWeekday(closedDate)) || `${weekdayName(isoWeekday(closedDate))}ens`;
  return `Beställningar för ${gen} leverans är nu stängda. Din nästa möjliga leverans är ${formatDeliveryDate(nextOpenDate)}.`;
}

/**
 * Framförhållningen får inte stänga nästa leveransdag före cutoff.
 * Onsdag förmiddag + torsdagsleverans + 2 dagars framförhållning skulle
 * annars dölja torsdagen – då når onsdagscutoffen aldrig kunden.
 */
export function leadTimeAllowingNextDelivery(
  configuredLeadTimeDays: number,
  weekdays: number[],
  settings: OpsSettings,
  now = new Date(),
  blockedDates: string[] = []
): number {
  const configured = Number.isInteger(configuredLeadTimeDays) && configuredLeadTimeDays >= 0 ? configuredLeadTimeDays : 0;
  const today = todayInStockholm(now);
  const allowed = new Set(weekdays.filter((w) => w >= 1 && w <= 7));
  if (allowed.size === 0) return configured;
  const blocked = new Set(blockedDates);
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    if (!allowed.has(isoWeekday(d))) continue;
    if (isSwedishHoliday(d)) continue;
    if (blocked.has(toISODate(d))) continue;
    if (isPastCutoff(d, settings, now)) continue;
    // earliest = today + lead + 1 ska vara ≤ d  ⇒  lead ≤ i − 1
    return Math.min(configured, Math.max(0, i - 1));
  }
  return configured;
}

export function clampWeekday(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 3;
}

export function clampHour(n: number): number {
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 12;
}
