import { describe, expect, it } from "vitest";
import { looksLikePersonalNumber, isValidOrgNumber } from "@/lib/validation";
import { safeBlockedDates } from "@/lib/products";

describe("personnummer-flagga i admin", () => {
  it("flaggar personnummerformat men inte aktiebolag", () => {
    expect(looksLikePersonalNumber("559141-7042")).toBe(false); // Landvex AB
    expect(looksLikePersonalNumber("556000-0002")).toBe(false);
    expect(looksLikePersonalNumber("850101-1234")).toBe(true); // ÅÅMMDD
    expect(looksLikePersonalNumber("9912310000")).toBe(true);
    expect(looksLikePersonalNumber("12345")).toBe(false);
  });

  it("rör inte Luhn-kontrollen", () => {
    expect(isValidOrgNumber("559141-7042")).toBe(true);
  });
});

describe("spärrade datum från databasen", () => {
  it("släpper bara igenom giltiga ISO-datum", () => {
    expect(safeBlockedDates('["2026-12-17","fel","2026-1-1",5]')).toEqual(["2026-12-17"]);
    expect(safeBlockedDates("trasig json")).toEqual([]);
    expect(safeBlockedDates("[]")).toEqual([]);
  });
});
