/**
 * Ett års drift utan databas: samma datum-/moms-/cutoff-motor som cronen.
 * Avslutar med kod 1 vid fel. Kompletterar tests/year-ops.test.ts (integration).
 */
import {
  addDays,
  changeDeadline,
  fromISODate,
  isoWeekParts,
  isoWeekday,
  isSwedishHoliday,
  nextCadenceDate,
  snapToDeliveryWeekday,
  stockholmTime,
  swedishHolidayName,
  toISODate,
} from "../src/lib/dates";
import { cutoffForDelivery, isPastCutoff } from "../src/lib/warehouse/cutoff";
import { DEFAULT_OPS_SETTINGS } from "../src/lib/warehouse/types";
import { agingKey } from "../src/lib/invoice/aging";
import { isInvoiceOverdue } from "../src/lib/status";
import { effectiveVatRateBp, FOOD_VAT_RATE_BP, foodVatNotice } from "../src/lib/vat";
import { invoiceConfig } from "../src/lib/config";

const WEEKDAYS = [4];
const cfg = { weekdays: WEEKDAYS, leadTimeDays: 2 };
const ops = DEFAULT_OPS_SETTINGS;
const FIRST = fromISODate("2026-09-17");
const END = fromISODate("2027-09-16");

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}
function assert(cond: unknown, msg: string) {
  if (!cond) fail(msg);
}

const thursdayHolidays: string[] = [];
for (let d = FIRST; d.getTime() <= END.getTime(); d = addDays(d, 1)) {
  if (isoWeekday(d) === 4 && isSwedishHoliday(d)) {
    thursdayHolidays.push(`${toISODate(d)} ${swedishHolidayName(d)}`);
  }
}
assert(
  thursdayHolidays.join("|") === "2026-12-24 julafton|2026-12-31 nyårsafton|2027-05-06 Kristi himmelsfärdsdag",
  `oväntade torsdagshelger: ${thursdayHolidays.join(", ")}`
);

type Freq = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
function simulate(freq: Freq) {
  const deliveries: string[] = [];
  let cadence = FIRST;
  while (cadence.getTime() <= END.getTime()) {
    const delivery = snapToDeliveryWeekday(cadence, cfg);
    const iso = toISODate(delivery);
    if (delivery.getTime() <= END.getTime() && !deliveries.includes(iso)) {
      deliveries.push(iso);
      const holiday = swedishHolidayName(delivery);
      assert(!holiday, `leverans ${toISODate(delivery)} är ${holiday}`);
      assert(isoWeekday(delivery) === 4, `leverans ${toISODate(delivery)} är inte torsdag`);
      const due = addDays(delivery, invoiceConfig.paymentTermsDays);
      assert(toISODate(due) > toISODate(delivery), "förfallodag måste vara efter leverans");
      assert(effectiveVatRateBp(FOOD_VAT_RATE_BP, toISODate(delivery)) === 600, `moms ${toISODate(delivery)}`);
      const cutoff = cutoffForDelivery(delivery, ops);
      assert(isoWeekday(cutoff) === 3, `cutoff för ${toISODate(delivery)} ska vara onsdag`);
      assert(isPastCutoff(delivery, ops, stockholmTime(delivery, 6)), "på leveransmorgonen är cutoff passerad");
      assert(!isPastCutoff(delivery, ops, new Date(cutoff.getTime() - 60_000)), "en minut före cutoff är dagen öppen");
    }
    cadence = nextCadenceDate(cadence, freq, WEEKDAYS);
  }
  return deliveries;
}

const weekly = simulate("WEEKLY");
const biweekly = simulate("BIWEEKLY");
const monthly = simulate("MONTHLY");

assert(weekly.length >= 48 && weekly.length <= 53, `veckovis ${weekly.length}`);
assert(biweekly.length >= 24 && biweekly.length <= 27, `varannan ${biweekly.length}`);
assert(monthly.length >= 12 && monthly.length <= 14, `månadsvis ${monthly.length}`);

const weeklySet = new Set(weekly);
assert(!weeklySet.has("2026-12-24"), "julleverans");
assert(!weeklySet.has("2026-12-31"), "nyårsleverans");
assert(!weeklySet.has("2027-05-06"), "kristi himmelsfärd");
assert(weeklySet.has("2026-12-17"), "sista leveransen före jul");
assert(weeklySet.has("2027-01-07"), "första efter nyår");
assert(weeklySet.has("2027-01-14"), "kadensen får inte driva en extra vecka efter jul");
assert(weeklySet.has("2027-04-29"), "före Kristi himmelsfärd");
assert(weeklySet.has("2027-05-13"), "efter Kristi himmelsfärd");

const gaps = weekly.slice(1).map((iso, i) => (fromISODate(iso).getTime() - fromISODate(weekly[i]!).getTime()) / 86400000);
assert(gaps.every((g) => g % 7 === 0 && g >= 7 && g <= 21), `oväntade gap: ${gaps.filter((g) => g !== 7).join(",")}`);
assert(gaps.some((g) => g >= 14), "helgdagar ska ge minst ett tvåvecorshopp");

assert(toISODate(changeDeadline(fromISODate("2027-01-07"), 2, 12)) === "2027-01-04", "trettondagen ska hoppas över i ändringsdeadline");

assert(JSON.stringify(isoWeekParts(fromISODate("2026-12-31"))) === JSON.stringify({ year: 2026, week: 53 }), "v53");
assert(JSON.stringify(isoWeekParts(fromISODate("2027-01-04"))) === JSON.stringify({ year: 2027, week: 1 }), "v1");
assert(isoWeekday(fromISODate("2026-12-13")) === 7, "Lucia 2026 är söndag");

const due = addDays(fromISODate("2026-12-17"), 30);
assert(toISODate(due) === "2027-01-16", "30 dagar från 17 dec = 16 jan");
assert(isInvoiceOverdue({ status: "UNPAID", dueDate: due }, fromISODate("2027-01-17")) === true, "förfallen efter förfallodag");
assert(isInvoiceOverdue({ status: "PAID", dueDate: due }, fromISODate("2027-02-01")) === false, "betald är inte förfallen");
assert(agingKey(due, fromISODate("2027-02-01")) === "overdue", "åldrande efter årsskifte");
assert(agingKey(due, fromISODate("2027-01-10")) === "dueSoon", "förfaller inom 7 dagar");
assert(foodVatNotice("2027-09-12", 4)?.urgent === false, "momsvarning inte brådskande i september 2027");
assert(foodVatNotice("2027-12-15", 4)?.urgent === true, "momsvarning brådskande i december 2027");
assert(effectiveVatRateBp(FOOD_VAT_RATE_BP, "2028-01-07") === 1200, "12 % från 2028");

// DST: sista söndagen i mars 2027 är påskdagen – cutoff onsdag före en torsdag
// runt bytet ska fortfarande vara svensk 12:00.
const springCutoff = cutoffForDelivery(fromISODate("2027-04-01"), ops); // skärtorsdag? 1 apr 2027 är torsdag, dagen efter påsk.
assert(isoWeekday(fromISODate("2027-04-01")) === 4, "1 apr 2027 torsdag");
assert(!isSwedishHoliday(fromISODate("2027-04-01")), "skärtorsdag är inte röd dag");
const autumnCutoff = cutoffForDelivery(fromISODate("2026-10-29"), ops);
assert(isoWeekday(fromISODate("2026-10-29")) === 4, "29 okt 2026 torsdag");
assert(springCutoff.getTime() < fromISODate("2027-04-01").getTime(), "vårs-cutoff före leverans");
assert(autumnCutoff.getTime() < fromISODate("2026-10-29").getTime(), "höst-cutoff före leverans");

console.log(
  JSON.stringify(
    {
      ok: true,
      weekly: weekly.length,
      biweekly: biweekly.length,
      monthly: monthly.length,
      thursdayHolidays,
      julgap: weekly.includes("2026-12-17") && weekly.includes("2027-01-07") ? "17 dec → 7 jan" : "?",
      invoiceDueFromMidsummer: toISODate(addDays(fromISODate("2027-06-17"), 30)),
    },
    null,
    2
  )
);
