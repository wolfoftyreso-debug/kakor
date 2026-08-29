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
