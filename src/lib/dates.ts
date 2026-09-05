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

/** Versal första bokstav — svenska datum skrivs "Torsdag 10 september", inte "Torsdag 10 September" (CSS capitalize). */
export function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

/** Som formatDeliveryDate men med år — för mejl och dokument som läses långt senare. */
export function formatDeliveryDateWithYear(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Verklig tidpunkt då dagens svenska dygn började (för createdAt-filter). */
export function startOfStockholmDay(now = new Date()): Date {
  const utcMidnight = todayInStockholm(now);
  const inStockholm = new Date(utcMidnight.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  const inUtc = new Date(utcMidnight.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = inStockholm.getTime() - inUtc.getTime();
  return new Date(utcMidnight.getTime() - offsetMs);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", dateStyle: "medium" }).format(date);
}

export interface DeliveryDayConfig {
  /** ISO-veckodagar (1–7) då leverans sker. */
  weekdays: number[];
  /** Beställ senast N hela dagar före leveransdagen. */
  leadTimeDays: number;
  /** ISO-datum (YYYY-MM-DD) som admin spärrat — semester, inventering, fulla dagar. */
  blockedDates?: string[];
}

/** Påskdagen (Gregoriansk, Meeus/Jones/Butcher) som UTC-midnatt. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Första lördagen i intervallet [fromDay, fromDay+6] i given månad (1–12). */
function saturdayOnOrAfter(year: number, month: number, fromDay: number): Date {
  const start = new Date(Date.UTC(year, month - 1, fromDay));
  const wd = isoWeekday(start); // 6 = lördag
  return addDays(start, (6 - wd + 7) % 7);
}

/**
 * Svenska helgdagar plus de aftnar då ingen tar emot leveranser (midsommar-,
 * jul- och nyårsafton). Vi levererar aldrig dessa dagar — kontoren är stängda.
 * Returnerar namnet på dagen, eller null.
 */
export function swedishHolidayName(date: Date): string | null {
  const y = date.getUTCFullYear();
  const iso = toISODate(date);
  const fixed: Record<string, string> = {
    [`${y}-01-01`]: "nyårsdagen",
    [`${y}-01-06`]: "trettondedag jul",
    [`${y}-05-01`]: "första maj",
    [`${y}-06-06`]: "nationaldagen",
    [`${y}-12-24`]: "julafton",
    [`${y}-12-25`]: "juldagen",
    [`${y}-12-26`]: "annandag jul",
    [`${y}-12-31`]: "nyårsafton",
  };
  if (fixed[iso]) return fixed[iso];
  const easter = easterSunday(y);
  const moving: [Date, string][] = [
    [addDays(easter, -2), "långfredagen"],
    [easter, "påskdagen"],
    [addDays(easter, 1), "annandag påsk"],
    [addDays(easter, 39), "Kristi himmelsfärdsdag"],
    [addDays(easter, 49), "pingstdagen"],
    [addDays(saturdayOnOrAfter(y, 6, 20), -1), "midsommarafton"],
    [saturdayOnOrAfter(y, 6, 20), "midsommardagen"],
    [saturdayOnOrAfter(y, 10, 31), "alla helgons dag"],
  ];
  for (const [d, name] of moving) if (toISODate(d) === iso) return name;
  return null;
}

export function isSwedishHoliday(date: Date): boolean {
  return swedishHolidayName(date) !== null;
}

function validWeekdays(config: DeliveryDayConfig): number[] {
  return [...new Set(config.weekdays)].filter((w) => w >= 1 && w <= 7);
}

/** Dag då vi faktiskt kör: rätt veckodag, inte helgdag, inte spärrad av admin. */
export function isDeliverableDay(date: Date, config: DeliveryDayConfig, weekdays = validWeekdays(config)): boolean {
  if (!weekdays.includes(isoWeekday(date))) return false;
  if (isSwedishHoliday(date)) return false;
  if (config.blockedDates?.includes(toISODate(date))) return false;
  return true;
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
  const weekdays = validWeekdays(config);
  if (weekdays.length === 0 || count <= 0) return [];
  const earliest = addDays(todayInStockholm(now), Math.max(0, config.leadTimeDays) + 1);
  const result: Date[] = [];
  let cursor = earliest;
  // Max ~26 veckor framåt som skydd mot oändlig loop.
  for (let i = 0; i < 7 * 26 && result.length < count; i++) {
    if (isDeliverableDay(cursor, config, weekdays)) result.push(cursor);
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
  const weekdays = validWeekdays(config);
  if (weekdays.length === 0) return date;
  let cursor = date;
  // Upp till fyra veckor: en helgdag eller spärrad vecka ska hoppas över, inte stoppa.
  for (let i = 0; i < 28; i++) {
    if (isDeliverableDay(cursor, config, weekdays)) return cursor;
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
  // Justera till närmast följande giltiga dag (veckodag, ej helgdag, ej spärrad).
  const weekdays = validWeekdays(config);
  if (weekdays.length === 0) return target;
  let cursor = target;
  for (let i = 0; i < 28; i++) {
    if (isDeliverableDay(cursor, config, weekdays)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return target;
}

/** Riktig tidsstämpel (t.ex. levererad kl 00:30) — visas i svensk tid, inte UTC. */
export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Tidsstämpel för klockslag (0–23) i svensk tid på ett rent datum (UTC-midnatt). */
export function stockholmTime(date: Date, hour: number): Date {
  const iso = toISODate(date);
  const naive = new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  const inStockholm = new Date(naive.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  const inUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(naive.getTime() - (inStockholm.getTime() - inUtc.getTime()));
}

/** Arbetsdag = måndag–fredag som inte är helgdag. */
export function isWorkday(date: Date): boolean {
  return isoWeekday(date) <= 5 && !isSwedishHoliday(date);
}

/**
 * Sista tidpunkt för ändring/avbokning: kl. `hour` svensk tid, `workdays`
 * arbetsdagar före leveransdagen. Leverans torsdag med 2 arbetsdagar ⇒ tisdag kl 12.
 */
export function changeDeadline(deliveryDate: Date, workdays: number, hour: number): Date {
  let cursor = deliveryDate;
  let left = Math.max(0, workdays);
  while (left > 0) {
    cursor = addDays(cursor, -1);
    if (isWorkday(cursor)) left--;
  }
  return stockholmTime(cursor, hour);
}

/** "tisdag 8 september kl. 12.00" */
export function formatDeadline(deadline: Date): string {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", weekday: "long", day: "numeric", month: "long" }).format(deadline);
  const time = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(deadline);
  return `${day} kl. ${time.replace(":", ".")}`;
}

/**
 * Kadensankare för prenumerationer: närmaste dag (samma eller senare) på
 * områdets veckodagar, UTAN hänsyn till helgdagar och spärrade datum.
 * Själva leveransen snäpps separat (snapToDeliveryWeekday) — annars driver
 * kadensen en vecka varje gång en helgdag skjuter en leverans.
 */
export function snapToWeekday(date: Date, weekdays: number[]): Date {
  const valid = [...new Set(weekdays)].filter((w) => w >= 1 && w <= 7);
  if (valid.length === 0) return date;
  let cursor = date;
  for (let i = 0; i < 7; i++) {
    if (valid.includes(isoWeekday(cursor))) return cursor;
    cursor = addDays(cursor, 1);
  }
  return date;
}

/** Nästa kadensdatum: fast intervall från ankaret, snäppt till veckodag (inte helgdag). */
export function nextCadenceDate(after: Date, frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY", weekdays: number[]): Date {
  const gapDays = frequency === "WEEKLY" ? 7 : frequency === "BIWEEKLY" ? 14 : 28;
  return snapToWeekday(addDays(after, gapDays), weekdays);
}

/** "torsdag", "tisdag och torsdag", "måndag, onsdag och torsdag". */
export function listSv(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} och ${items[items.length - 1]}`;
}
