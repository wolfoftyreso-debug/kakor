import { describe, expect, it } from "vitest";
import { canTransitionOrder, isInvoiceOverdue, isOrderOverdue } from "@/lib/status";

const past = new Date("2026-08-01T00:00:00.000Z");
const invoiceUnpaidPast = { status: "UNPAID", dueDate: past };

describe("förfallen-härledning", () => {
  it("obetald faktura efter förfallodatum är förfallen", () => {
    expect(isInvoiceOverdue(invoiceUnpaidPast, new Date("2026-08-30T12:00:00Z"))).toBe(true);
  });

  it("förfallen först dagen EFTER förfallodagen (svensk tid)", () => {
    const due = new Date("2026-08-30T00:00:00.000Z");
    // Kl 21:00 UTC 30/8 = 23:00 svensk sommartid samma dag → ej förfallen.
    expect(isInvoiceOverdue({ status: "UNPAID", dueDate: due }, new Date("2026-08-30T21:00:00Z"))).toBe(false);
    // Kl 22:30 UTC 30/8 = 00:30 svensk tid 31/8 → förfallen.
    expect(isInvoiceOverdue({ status: "UNPAID", dueDate: due }, new Date("2026-08-30T22:30:00Z"))).toBe(true);
  });

  it("betald faktura är aldrig förfallen", () => {
    expect(isInvoiceOverdue({ status: "PAID", dueDate: past })).toBe(false);
  });

  it("avbruten order är aldrig förfallen, oavsett fakturan", () => {
    expect(isOrderOverdue({ status: "CANCELLED", invoice: invoiceUnpaidPast })).toBe(false);
    expect(isOrderOverdue({ status: "CONFIRMED", invoice: invoiceUnpaidPast })).toBe(true);
    expect(isOrderOverdue({ status: "NEW", invoice: null })).toBe(false);
  });
});

describe("orderövergångsvakter", () => {
  const base = { paymentStatus: "UNPAID", deliveryStatus: "PENDING" };

  it("avbruten order kan inte betalas, levereras eller bekräftas", () => {
    const cancelled = { ...base, status: "CANCELLED" };
    expect(canTransitionOrder(cancelled, "pay")).toBe(false);
    expect(canTransitionOrder(cancelled, "deliver")).toBe(false);
    expect(canTransitionOrder(cancelled, "confirm")).toBe(false);
    expect(canTransitionOrder(cancelled, "cancel")).toBe(false);
  });

  it("betald eller levererad order kan inte avbrytas", () => {
    expect(canTransitionOrder({ status: "CONFIRMED", paymentStatus: "PAID", deliveryStatus: "PENDING" }, "cancel")).toBe(false);
    expect(canTransitionOrder({ status: "CONFIRMED", paymentStatus: "UNPAID", deliveryStatus: "DELIVERED" }, "cancel")).toBe(false);
  });

  it("normala övergångar tillåts", () => {
    const active = { ...base, status: "NEW" };
    expect(canTransitionOrder(active, "pay")).toBe(true);
    expect(canTransitionOrder(active, "deliver")).toBe(true);
    expect(canTransitionOrder(active, "confirm")).toBe(true);
    expect(canTransitionOrder(active, "cancel")).toBe(true);
  });
});
