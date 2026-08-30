import { describe, expect, it } from "vitest";
import { formatWeightKg, lineWeightGrams, priceSuffix, qtyLabel, unitLabel } from "@/lib/units";

describe("försäljningsenheter", () => {
  it("etiketter per enhet", () => {
    expect(unitLabel("kg")).toBe("kg");
    expect(unitLabel("paket")).toBe("paket");
    expect(qtyLabel(3, "kg")).toBe("3 kg");
    expect(qtyLabel(2, "paket")).toBe("2 paket");
    expect(priceSuffix("kg")).toBe("/kg");
    expect(priceSuffix("paket")).toBe("/paket");
  });

  it("okänd enhet faller tillbaka på kg", () => {
    expect(unitLabel("")).toBe("kg");
    expect(priceSuffix("styck")).toBe("/kg");
  });

  it("radvikt: lösvikt per kilo, paket via paketvikten", () => {
    expect(lineWeightGrams(3, "kg", 0)).toBe(3000);
    expect(lineWeightGrams(2, "paket", 1500)).toBe(3000);
  });

  it("viktformat med svensk decimalkomma", () => {
    expect(formatWeightKg(3000)).toBe("3 kg");
    expect(formatWeightKg(1500)).toBe("1,5 kg");
    expect(formatWeightKg(4500)).toBe("4,5 kg");
  });
});
