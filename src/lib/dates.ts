// Datumhjälpare. Alla leveransdatum hanteras som "rena" datum (UTC-midnatt),
// och "idag" beräknas i svensk tid så att kvällsbeställningar får rätt dag.

export function todayInStockholm(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"
  return new Date(`${parts}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** ISO-veckodag: 1 = måndag ... 7 = söndag. */
export function isoWeekday(date: Date): number {
  const wd = date.getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const WEEKDAY_NAMES = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];

export function weekdayName(isoWd: number): string {
  return WEEKDAY_NAMES[isoWd - 1] ?? "";
}

/** "tisdag 8 september" */
export function formatDeliveryDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", dateStyle: "medium" }).format(date);
}

export interface DeliveryDayConfig {
  /** ISO-veckodagar (1–7) då leverans sker. */
  weekdays: number[];
  /** Beställ senast N hela dagar före leveransdagen. */
  leadTimeDays: number;
}

/**
 * Nästa tillgängliga leveransdatum. Passerade datum och datum inom
 * framförhållningstiden erbjuds aldrig.
 */
export function upcomingDeliveryDates(
  config: DeliveryDayConfig,
  count: number,
  now = new Date()
): Date[] {
  const weekdays = [...new Set(config.weekdays)].filter((w) => w >= 1 && w <= 7);
  if (weekdays.length === 0 || count <= 0) return [];
  const earliest = addDays(todayInStockholm(now), Math.max(0, config.leadTimeDays) + 1);
  const result: Date[] = [];
  let cursor = earliest;
  // Max ~26 veckor framåt som skydd mot oändlig loop.
  for (let i = 0; i < 7 * 26 && result.length < count; i++) {
    if (weekdays.includes(isoWeekday(cursor))) result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

/** Är datumet ett giltigt kommande leveransdatum för konfigurationen? */
export function isValidDeliveryDate(date: Date, config: DeliveryDayConfig, now = new Date()): boolean {
  const candidates = upcomingDeliveryDates(config, 30, now);
  const iso = toISODate(date);
  return candidates.some((c) => toISODate(c) === iso);
}

/**
 * Närmaste datum (samma dag eller senare) som är en giltig leveransveckodag.
 * Används när ett områdes leveransdagar ändrats efter att en prenumeration
 * fått sitt nästa datum — ordrar får aldrig hamna på dagar utan leverans.
 */
export function snapToDeliveryWeekday(date: Date, config: DeliveryDayConfig): Date {
  const weekdays = [...new Set(config.weekdays)].filter((w) => w >= 1 && w <= 7);
  if (weekdays.length === 0) return date;
  let cursor = date;
  for (let i = 0; i < 7; i++) {
    if (weekdays.includes(isoWeekday(cursor))) return cursor;
    cursor = addDays(cursor, 1);
  }
  return date;
}

/** Nästa leveransdatum för en prenumeration efter ett givet datum. */
export function nextSubscriptionDate(
  after: Date,
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY",
  config: DeliveryDayConfig
): Date {
  const gapDays = frequency === "WEEKLY" ? 7 : frequency === "BIWEEKLY" ? 14 : 28;
  const target = addDays(after, gapDays);
  // Justera till närmast följande giltiga veckodag.
  const weekdays = [...new Set(config.weekdays)].filter((w) => w >= 1 && w <= 7);
  if (weekdays.length === 0) return target;
  let cursor = target;
  for (let i = 0; i < 7; i++) {
    if (weekdays.includes(isoWeekday(cursor))) return cursor;
    cursor = addDays(cursor, 1);
  }
  return target;
}
