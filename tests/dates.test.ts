import { describe, expect, it } from "vitest";
import {
  fromISODate,
  isValidDeliveryDate,
  isoWeekday,
  nextSubscriptionDate,
  toISODate,
  upcomingDeliveryDates,
} from "@/lib/dates";
import { isInvoiceOverdue } from "@/lib/status";

// Fast "nu": torsdag 2026-09-03 kl 10:00 svensk tid.
const NOW = new Date("2026-09-03T08:00:00.000Z");
const CONFIG = { weekdays: [2, 4], leadTimeDays: 2 }; // tis + tors, 2 dagars framförhållning

describe("leveransdatum", () => {
  it("erbjuder aldrig passerade datum eller datum inom framförhållningen", () => {
    const dates = upcomingDeliveryDates(CONFIG, 4, NOW);
    // Tidigast valbara dag är 2026-09-06 (idag + 2 + 1) => första tisdag är 8/9.
    expect(dates.map(toISODate)).toEqual(["2026-09-08", "2026-09-10", "2026-09-15", "2026-09-17"]);
    for (const d of dates) {
      expect([2, 4]).toContain(isoWeekday(d));
      expect(d.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("validerar bara datum som faktiskt erbjuds", () => {
    expect(isValidDeliveryDate(fromISODate("2026-09-08"), CONFIG, NOW)).toBe(true);
    expect(isValidDeliveryDate(fromISODate("2026-09-04"), CONFIG, NOW)).toBe(false); // för nära
    expect(isValidDeliveryDate(fromISODate("2026-09-09"), CONFIG, NOW)).toBe(false); // onsdag
    expect(isValidDeliveryDate(fromISODate("2026-08-25"), CONFIG, NOW)).toBe(false); // passerat
  });

  it("hanterar tom veckodagskonfiguration utan krasch", () => {
    expect(upcomingDeliveryDates({ weekdays: [], leadTimeDays: 2 }, 3, NOW)).toEqual([]);
  });
});

describe("prenumerationens nästa datum", () => {
  it("varje vecka: samma veckodag en vecka senare", () => {
    const next = nextSubscriptionDate(fromISODate("2026-09-08"), "WEEKLY", CONFIG);
    expect(toISODate(next)).toBe("2026-09-15");
  });

  it("varannan vecka", () => {
    const next = nextSubscriptionDate(fromISODate("2026-09-08"), "BIWEEKLY", CONFIG);
    expect(toISODate(next)).toBe("2026-09-22");
  });

  it("månadsvis (28 dagar) landar på giltig veckodag", () => {
    const next = nextSubscriptionDate(fromISODate("2026-09-08"), "MONTHLY", CONFIG);
    expect(toISODate(next)).toBe("2026-10-06");
    expect([2, 4]).toContain(isoWeekday(next));
  });

  it("justerar fram till nästa giltiga veckodag om målet inte är leveransdag", () => {
    // Start onsdag -> +7 = onsdag -> justeras till torsdag.
    const next = nextSubscriptionDate(fromISODate("2026-09-09"), "WEEKLY", CONFIG);
    expect(toISODate(next)).toBe("2026-09-17");
  });
});

describe("förfallen faktura (härledd, aldrig lagrad)", () => {
  it("obetald efter förfallodatum är förfallen", () => {
    expect(isInvoiceOverdue({ status: "UNPAID", dueDate: fromISODate("2026-09-01") }, NOW)).toBe(true);
  });
  it("obetald före förfallodatum är inte förfallen", () => {
    expect(isInvoiceOverdue({ status: "UNPAID", dueDate: fromISODate("2026-09-04") }, NOW)).toBe(false);
  });
  it("betald är aldrig förfallen", () => {
    expect(isInvoiceOverdue({ status: "PAID", dueDate: fromISODate("2026-09-01") }, NOW)).toBe(false);
  });
});

describe("snapToDeliveryWeekday", () => {
  it("lämnar ett datum som redan är leveransdag orört", async () => {
    const { snapToDeliveryWeekday, fromISODate, toISODate } = await import("@/lib/dates");
    // 2026-09-03 är en torsdag
    const d = snapToDeliveryWeekday(fromISODate("2026-09-03"), { weekdays: [4], leadTimeDays: 2 });
    expect(toISODate(d)).toBe("2026-09-03");
  });
  it("flyttar en tisdag fram till torsdag när området bara levererar torsdagar", async () => {
    const { snapToDeliveryWeekday, fromISODate, toISODate } = await import("@/lib/dates");
    // 2026-09-01 är en tisdag
    const d = snapToDeliveryWeekday(fromISODate("2026-09-01"), { weekdays: [4], leadTimeDays: 2 });
    expect(toISODate(d)).toBe("2026-09-03");
  });
  it("returnerar datumet oförändrat om inga veckodagar är konfigurerade", async () => {
    const { snapToDeliveryWeekday, fromISODate, toISODate } = await import("@/lib/dates");
    const d = snapToDeliveryWeekday(fromISODate("2026-09-01"), { weekdays: [], leadTimeDays: 2 });
    expect(toISODate(d)).toBe("2026-09-01");
  });
});

// ---------- Helgdagar och spärrade datum (kund- och affärsgranskning) ----------
import { easterSunday, isSwedishHoliday, swedishHolidayName, snapToDeliveryWeekday } from "@/lib/dates";

describe("svenska helgdagar", () => {
  it("räknar påsk rätt (Meeus) för flera år", () => {
    expect(toISODate(easterSunday(2026))).toBe("2026-04-05");
    expect(toISODate(easterSunday(2027))).toBe("2027-03-28");
    expect(toISODate(easterSunday(2028))).toBe("2028-04-16");
    expect(toISODate(easterSunday(2030))).toBe("2030-04-21");
  });

  it("känner igen rörliga helgdagar 2026", () => {
    expect(swedishHolidayName(fromISODate("2026-04-03"))).toBe("långfredagen");
    expect(swedishHolidayName(fromISODate("2026-04-06"))).toBe("annandag påsk");
    expect(swedishHolidayName(fromISODate("2026-05-14"))).toBe("Kristi himmelsfärdsdag"); // torsdag!
    expect(swedishHolidayName(fromISODate("2026-05-24"))).toBe("pingstdagen");
    expect(swedishHolidayName(fromISODate("2026-06-19"))).toBe("midsommarafton");
    expect(swedishHolidayName(fromISODate("2026-06-20"))).toBe("midsommardagen");
    expect(swedishHolidayName(fromISODate("2026-10-31"))).toBe("alla helgons dag");
    expect(swedishHolidayName(fromISODate("2027-11-06"))).toBe("alla helgons dag");
  });

  it("känner igen fasta dagar och lämnar vanliga dagar", () => {
    for (const iso of ["2026-01-01", "2026-01-06", "2026-05-01", "2026-06-06", "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-31"]) {
      expect(isSwedishHoliday(fromISODate(iso)), iso).toBe(true);
    }
    for (const iso of ["2026-09-10", "2026-05-07", "2026-05-21", "2026-12-17"]) {
      expect(isSwedishHoliday(fromISODate(iso)), iso).toBe(false);
    }
  });

  it("erbjuder aldrig Kristi himmelsfärd som torsdagsleverans", () => {
    const now = new Date("2026-05-04T08:00:00.000Z"); // måndag 4 maj
    const dates = upcomingDeliveryDates({ weekdays: [4], leadTimeDays: 2 }, 3, now).map(toISODate);
    expect(dates).toEqual(["2026-05-07", "2026-05-21", "2026-05-28"]);
    expect(isValidDeliveryDate(fromISODate("2026-05-14"), { weekdays: [4], leadTimeDays: 2 }, now)).toBe(false);
  });

  it("hoppar över julveckan: 24 och 31 december är torsdagar 2026", () => {
    const now = new Date("2026-12-14T08:00:00.000Z");
    const dates = upcomingDeliveryDates({ weekdays: [4], leadTimeDays: 2 }, 3, now).map(toISODate);
    expect(dates).toEqual(["2026-12-17", "2027-01-07", "2027-01-14"]);
  });
});

describe("spärrade datum från admin", () => {
  const config = { weekdays: [4], leadTimeDays: 2, blockedDates: ["2026-09-17"] };

  it("tas bort ur listan och godkänns inte vid validering", () => {
    const dates = upcomingDeliveryDates(config, 3, NOW).map(toISODate);
    expect(dates).toEqual(["2026-09-10", "2026-09-24", "2026-10-01"]);
    expect(isValidDeliveryDate(fromISODate("2026-09-17"), config, NOW)).toBe(false);
    expect(isValidDeliveryDate(fromISODate("2026-09-17"), { ...config, blockedDates: [] }, NOW)).toBe(true);
  });

  it("prenumerationer snäpper förbi spärrade dagar och helgdagar", () => {
    // Veckovis från 10/9 → 17/9 är spärrad → 24/9.
    expect(toISODate(nextSubscriptionDate(fromISODate("2026-09-10"), "WEEKLY", config))).toBe("2026-09-24");
    // Snäpp av ett redan satt datum som blivit helgdag.
    expect(toISODate(snapToDeliveryWeekday(fromISODate("2026-05-14"), { weekdays: [4], leadTimeDays: 2 }))).toBe("2026-05-21");
  });
});
