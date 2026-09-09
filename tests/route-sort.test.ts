import { describe, expect, it } from "vitest";
import { sortStopsByRoute } from "@/lib/warehouse/route";

describe("körlista per område", () => {
  it("sorterar Tyresö → Nacka → Haninge → Huddinge, sedan postnummer", () => {
    const sorted = sortStopsByRoute([
      { areaSortOrder: 4, deliveryCity: "Huddinge", deliveryPostalCode: "141 52", companyName: "Flemingsbergs Kontor AB" },
      { areaSortOrder: 2, deliveryCity: "Nacka", deliveryPostalCode: "131 54", companyName: "Sickla Verkstad AB" },
      { areaSortOrder: 1, deliveryCity: "Tyresö", deliveryPostalCode: "135 49", companyName: "Tyresö El & Automation AB" },
      { areaSortOrder: 1, deliveryCity: "Tyresö", deliveryPostalCode: "135 40", companyName: "Granuddens Bygg AB" },
      { deliveryCity: "Haninge", deliveryPostalCode: "136 40", companyName: "Handens Industri AB" },
    ]);
    expect(sorted.map((s) => s.companyName)).toEqual([
      "Granuddens Bygg AB",
      "Tyresö El & Automation AB",
      "Sickla Verkstad AB",
      "Handens Industri AB",
      "Flemingsbergs Kontor AB",
    ]);
  });
});
