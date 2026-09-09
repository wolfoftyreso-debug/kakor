import {
  addDays,
  formatDeliveryDate,
  isoWeekday,
  stockholmTime,
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

export function clampWeekday(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 3;
}

export function clampHour(n: number): number {
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 12;
}
