import { describe, expect, it } from "vitest";
import {
  datesInIsoWeek,
  fromISODate,
  isoWeekParam,
  isoWeekParts,
  mondayOfIsoWeek,
  parseIsoWeekParam,
  toISODate,
} from "@/lib/dates";
import { canTransitionPick, isWeekLockedStatus, isWeekSealedStatus, orderReservesStock } from "@/lib/status";
import { cutoffClosedMessage, cutoffForDelivery, isPastCutoff, leadTimeAllowingNextDelivery } from "@/lib/warehouse/cutoff";
import { productionNeedGrams, hasActivePick, gramsForLine } from "@/lib/warehouse/inventory";
import { appendLateChange, parseLateChanges, parseSnapshot } from "@/lib/warehouse/snapshot";
import type { DeliverySnapshot } from "@/lib/warehouse/types";

describe("ISO-vecka", () => {
  it("torsdag 10 september 2026 är vecka 37", () => {
    const p = isoWeekParts(fromISODate("2026-09-10"));
    expect(p).toEqual({ year: 2026, week: 37 });
    expect(isoWeekParam(p.year, p.week)).toBe("2026-W37");
    expect(parseIsoWeekParam("2026-W37")).toEqual(p);
  });

  it("måndagen i vecka 37 är 7 september", () => {
    expect(toISODate(mondayOfIsoWeek(2026, 37))).toBe("2026-09-07");
    expect(datesInIsoWeek(2026, 37).map(toISODate)).toContain("2026-09-10");
  });

  it("1 januari 2026 tillhör vecka 1 2026", () => {
    expect(isoWeekParts(fromISODate("2026-01-01"))).toEqual({ year: 2026, week: 1 });
  });
});

describe("onsdagscutoff", () => {
  const settings = { cutoffWeekday: 3, cutoffHour: 12, opsEmail: "" };

  it("torsdagsleverans låses onsdagen samma vecka kl 12", () => {
    const delivery = fromISODate("2026-09-10");
    const cutoff = cutoffForDelivery(delivery, settings);
    // Onsdag 9 sep 2026 kl 12 svensk sommartid = 10:00 UTC
    expect(cutoff.toISOString()).toBe("2026-09-09T10:00:00.000Z");
  });

  it("före cutoff är dagen öppen, efter är den stängd", () => {
    const delivery = fromISODate("2026-09-10");
    expect(isPastCutoff(delivery, settings, new Date("2026-09-09T09:59:00.000Z"))).toBe(false);
    expect(isPastCutoff(delivery, settings, new Date("2026-09-09T10:00:00.000Z"))).toBe(true);
  });

  it("formulerar kundmeddelandet utan att be om kontakt", () => {
    const msg = cutoffClosedMessage(fromISODate("2026-09-10"), fromISODate("2026-09-17"));
    expect(msg).toContain("torsdagens leverans är nu stängda");
    expect(msg).toContain("torsdag 17 september");
    expect(msg.toLowerCase()).not.toContain("kontakta");
  });
});

describe("produktionsbehov och lagerprincip", () => {
  it("behov = max(0, beställt − fysiskt)", () => {
    expect(productionNeedGrams(14000, 10000)).toBe(4000);
    expect(productionNeedGrams(7000, 10000)).toBe(0);
    expect(productionNeedGrams(0, 0)).toBe(0);
  });

  it("öppen olevererad order reserverar lager tills den plockas", () => {
    expect(orderReservesStock({ status: "NEW", deliveryStatus: "PENDING", pickStatus: "UNPICKED" })).toBe(true);
    expect(orderReservesStock({ status: "CONFIRMED", deliveryStatus: "PENDING", pickStatus: "PICKED" })).toBe(false);
    expect(orderReservesStock({ status: "CANCELLED", deliveryStatus: "PENDING", pickStatus: "UNPICKED" })).toBe(false);
    expect(orderReservesStock({ status: "NEW", deliveryStatus: "DELIVERED", pickStatus: "UNPICKED" })).toBe(false);
  });
});

describe("plockövergångar", () => {
  it("Unpicked → Picked → Lastad → Levererad", () => {
    expect(canTransitionPick("UNPICKED", "PICKED")).toBe(true);
    expect(canTransitionPick("PICKED", "LOADED")).toBe(true);
    expect(canTransitionPick("LOADED", "DELIVERED")).toBe(true);
    expect(canTransitionPick("DELIVERED", "UNPICKED")).toBe(false);
    expect(canTransitionPick("UNPICKED", "LOADED")).toBe(false);
  });
});

describe("låst vecka och snapshot", () => {
  it("LOCKED och senare är låsta tillstånd", () => {
    expect(isWeekLockedStatus("OPEN")).toBe(false);
    expect(isWeekLockedStatus("LOCKING")).toBe(false);
    expect(isWeekLockedStatus("LOCKED")).toBe(true);
    expect(isWeekLockedStatus("COMPLETED")).toBe(true);
  });

  it("avvisar ogiltig snapshot och behåller giltig", () => {
    expect(parseSnapshot("")).toBeNull();
    expect(parseSnapshot("{")).toBeNull();
    const snap: DeliverySnapshot = {
      version: 1,
      lockedAt: new Date().toISOString(),
      lockedBy: "system",
      deliveryDate: "2026-09-10",
      isoYear: 2026,
      isoWeek: 37,
      orderCount: 0,
      totalGrams: 0,
      stops: [],
      byProduct: [],
    };
    expect(parseSnapshot(JSON.stringify(snap))?.deliveryDate).toBe("2026-09-10");
  });

  it("efterhandsändringar läggs till, ursprunglig JSON muteras inte bakåt", () => {
    const first = appendLateChange("[]", { actor: "a@b.se", reason: "Sen order", type: "ORDER_ADDED", detail: "Kund X" });
    const second = appendLateChange(first, { actor: "a@b.se", reason: "Notering", type: "NOTE", detail: "Portkod" });
    expect(parseLateChanges(first)).toHaveLength(1);
    expect(parseLateChanges(second)).toHaveLength(2);
    expect(parseLateChanges(second)[0].detail).toBe("Kund X");
  });
});

describe("framförhållning vs onsdagscutoff", () => {
  const settings = { cutoffWeekday: 3, cutoffHour: 12, opsEmail: "" };

  it("onsdag förmiddag håller torsdagen öppen trots 2 dagars framförhållning", () => {
    const wedMorning = new Date("2026-09-09T08:00:00.000Z"); // 10:00 svensk sommartid
    expect(leadTimeAllowingNextDelivery(2, [4], settings, wedMorning)).toBe(0);
  });

  it("onsdag efter cutoff lämnar framförhållningen orörd", () => {
    const wedAfternoon = new Date("2026-09-09T11:00:00.000Z"); // 13:00 svensk sommartid
    expect(leadTimeAllowingNextDelivery(2, [4], settings, wedAfternoon)).toBe(2);
  });

  it("tisdag sänker framförhållningen så torsdagen syns", () => {
    const tue = new Date("2026-09-08T08:00:00.000Z");
    expect(leadTimeAllowingNextDelivery(2, [4], settings, tue)).toBe(1);
  });

  it("hoppar över spärrad nästa dag så framförhållningen inte kollapsar fel", () => {
    const wedMorning = new Date("2026-09-09T08:00:00.000Z");
    expect(leadTimeAllowingNextDelivery(2, [4], settings, wedMorning, ["2026-09-10"])).toBe(2);
  });
});

describe("orderradens paketvikt vinner över live-produkten", () => {
  it("använder snapshotad paketvikt", () => {
    expect(gramsForLine({ weightKg: 2, unit: "paket", packageWeightGrams: 1500, product: { packageWeightGrams: 2000 } })).toBe(3000);
    expect(gramsForLine({ weightKg: 2, unit: "paket", packageWeightGrams: 0, product: { packageWeightGrams: 1500 } })).toBe(3000);
  });
});

describe("låst inkluderar LOCKING för kassa och efterhandsändring", () => {
  it("LOCKING är förseglad men inte historiskt låst", () => {
    expect(isWeekSealedStatus("LOCKING")).toBe(true);
    expect(isWeekLockedStatus("LOCKING")).toBe(false);
    expect(isWeekSealedStatus("LOCKED")).toBe(true);
  });
});

describe("PROBLEM efter plock reserverar inte igen", () => {
  it("aktiv PICK utan UNPICK räknas som redan dragen", () => {
    const pick = { kind: "PICK", createdAt: new Date("2026-09-09T10:00:00Z") };
    const unpick = { kind: "UNPICK", createdAt: new Date("2026-09-09T09:00:00Z") };
    expect(hasActivePick([pick])).toBe(true);
    expect(hasActivePick([pick, unpick])).toBe(true);
    expect(hasActivePick([{ kind: "UNPICK", createdAt: new Date("2026-09-09T11:00:00Z") }, pick])).toBe(false);
    expect(hasActivePick([])).toBe(false);
  });
});
