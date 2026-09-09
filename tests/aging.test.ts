import { describe, expect, it } from "vitest";
import { addDays, fromISODate } from "@/lib/dates";
import { addToAging, agingKey, emptyAging, remainingOre } from "@/lib/invoice/aging";

describe("reskontra-åldrande", () => {
  const today = fromISODate("2026-09-09");

  it("räknar av kreditbelopp (negativa) från att-betala", () => {
    expect(remainingOre(10600, [{ totalOre: -3180 }])).toBe(7420);
    expect(remainingOre(5000, [{ totalOre: -5000 }])).toBe(0);
    expect(remainingOre(1000, [{ totalOre: -2000 }])).toBe(0);
  });

  it("delar obetalda i förfallet / inom 7 dagar / senare", () => {
    expect(agingKey(fromISODate("2026-09-05"), today)).toBe("overdue");
    expect(agingKey(fromISODate("2026-09-09"), today)).toBe("dueSoon");
    expect(agingKey(fromISODate("2026-09-12"), today)).toBe("dueSoon");
    expect(agingKey(fromISODate("2026-09-16"), today)).toBe("dueSoon");
    expect(agingKey(fromISODate("2026-09-17"), today)).toBe("later");
  });

  it("summerar hinkarna", () => {
    const s = emptyAging();
    addToAging(s, "overdue", 100);
    addToAging(s, "overdue", 50);
    addToAging(s, "dueSoon", 20);
    expect(s).toEqual({
      overdueCount: 2,
      overdueOre: 150,
      dueSoonCount: 1,
      dueSoonOre: 20,
      laterCount: 0,
      laterOre: 0,
    });
    expect(addDays(today, 7).toISOString().slice(0, 10)).toBe("2026-09-16");
  });
});
