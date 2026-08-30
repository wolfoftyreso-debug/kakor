import { describe, expect, it } from "vitest";
import { allergenChips } from "@/lib/allergens";

describe("allergenChips", () => {
  it("enkel innehåller-rad utan spår", () => {
    expect(allergenChips("Innehåller vete, smör (mjölk).")).toEqual(["Vete", "Smör (mjölk)"]);
  });

  it("punkten mitt i meningen följer aldrig med in i en chip", () => {
    expect(
      allergenChips("Innehåller vete, smör (mjölk). Kan innehålla spår av mandel.")
    ).toEqual(["Vete", "Smör (mjölk)", "Mandel (spår)"]);
  });

  it("flera spår-allergener märks var för sig", () => {
    expect(
      allergenChips("Innehåller vete. Kan innehålla spår av mandel, hasselnöt.")
    ).toEqual(["Vete", "Mandel (spår)", "Hasselnöt (spår)"]);
  });

  it("tom rad ger inga chips", () => {
    expect(allergenChips("")).toEqual([]);
  });
});
