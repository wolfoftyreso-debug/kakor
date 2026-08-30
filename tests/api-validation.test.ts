import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validation";

// API-gränsen: servern accepterar bara explicita, validerade fält.
// Klientens "totalsumma" finns inte ens i schemat — priset räknas alltid om.

const validBody = {
  items: [{ productId: "abc123", weightKg: 2 }],
  areaSlug: "tyreso",
  deliveryDate: "2026-09-08",
  companyName: "Företaget AB",
  orgNumber: "556677-8899",
  contactName: "Anna Andersson",
  email: "anna@foretaget.se",
  phone: "070-123 45 67",
  deliveryAddress: "Testgatan 1",
  deliveryPostalCode: "135 48",
  deliveryCity: "Tyresö",
  deliveryInstruction: "",
  invoiceEmail: "faktura@foretaget.se",
  reference: "",
  billingAddress: "",
};

describe("checkout-validering (server-side)", () => {
  it("accepterar giltig beställning", () => {
    expect(checkoutSchema.safeParse(validBody).success).toBe(true);
  });

  it("prismanipulation är omöjlig — okända fält som total/price avvisas", () => {
    // strictObject: okända fält ger valideringsfel i stället för tyst strippning.
    expect(checkoutSchema.safeParse({ ...validBody, totalOre: 1 }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({
        ...validBody,
        items: [{ productId: "abc123", weightKg: 2, unitPrice: 1 }],
      }).success
    ).toBe(false);
  });

  it("avvisar dubblerade produktrader och orimligt många rader", () => {
    expect(
      checkoutSchema.safeParse({
        ...validBody,
        items: [
          { productId: "abc123", weightKg: 1 },
          { productId: "abc123", weightKg: 2 },
        ],
      }).success
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({
        ...validBody,
        items: Array.from({ length: 31 }, (_, i) => ({ productId: `p${i}`, weightKg: 1 })),
      }).success
    ).toBe(false);
  });

  it("avvisar tom varukorg", () => {
    expect(checkoutSchema.safeParse({ ...validBody, items: [] }).success).toBe(false);
  });

  it("avvisar extrema kvantiteter", () => {
    expect(
      checkoutSchema.safeParse({ ...validBody, items: [{ productId: "a", weightKg: 5000 }] }).success
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...validBody, items: [{ productId: "a", weightKg: 0 }] }).success
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...validBody, items: [{ productId: "a", weightKg: 1.5 }] }).success
    ).toBe(false);
  });

  it("avvisar ogiltigt organisationsnummer, postnummer och e-post", () => {
    expect(checkoutSchema.safeParse({ ...validBody, orgNumber: "123" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validBody, deliveryPostalCode: "abc" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validBody, email: "inte-en-mejl" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validBody, invoiceEmail: "x@" }).success).toBe(false);
  });

  it("avvisar trasig payload", () => {
    expect(checkoutSchema.safeParse(null).success).toBe(false);
    expect(checkoutSchema.safeParse("garbage").success).toBe(false);
    expect(checkoutSchema.safeParse({}).success).toBe(false);
  });
});
