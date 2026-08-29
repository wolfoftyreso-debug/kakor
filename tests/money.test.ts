import { describe, expect, it } from "vitest";
import { calculateTotals, formatOre, vatForLine } from "@/lib/money";

describe("moms & belopp (öre)", () => {
  it("beräknar 12 % moms per rad", () => {
    expect(vatForLine(29500, 1200)).toBe(3540);
  });

  it("avrundar moms per rad till hela ören", () => {
    expect(vatForLine(101, 1200)).toBe(12); // 12,12 -> 12
  });

  it("summerar subtotal, moms och total", () => {
    const totals = calculateTotals([
      { netOre: 29500, vatRateBp: 1200 }, // 1 kg à 295 kr
      { netOre: 59000, vatRateBp: 1200 }, // 2 kg à 295 kr
    ]);
    expect(totals.subtotalOre).toBe(88500);
    expect(totals.vatOre).toBe(10620);
    expect(totals.totalOre).toBe(99120);
  });

  it("hanterar tom orderrad-lista", () => {
    expect(calculateTotals([])).toEqual({ subtotalOre: 0, vatOre: 0, totalOre: 0 });
  });

  it("formaterar öre till kronor", () => {
    expect(formatOre(29500).replace(/ /g, " ")).toBe("295 kr");
    expect(formatOre(99120).replace(/ /g, " ")).toBe("991,20 kr");
  });
});
