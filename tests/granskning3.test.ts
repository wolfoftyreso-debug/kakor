import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { rateLimitShared } from "@/lib/rate-limit";
import { effectiveVatRateBp } from "@/lib/vat";
import { fromISODate, nextCadenceDate, snapToDeliveryWeekday, snapToWeekday, toISODate, listSv, upcomingDeliveryDates } from "@/lib/dates";
import { createOrder } from "@/lib/orders/create-order";
import { issueCreditNote } from "@/lib/invoice/credit";
import { orgNumber } from "./helpers";

describe("delad rate limit utan nollställningskapplöpning", () => {
  it("25 parallella anrop mot en tom nyckel räknas alla — aldrig fler än `limit` släpps igenom", async () => {
    const key = `test-par-${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 25 }, () => rateLimitShared(key, { limit: 10, windowMs: 60_000 }))
    );
    const passed = results.filter((r) => r.ok).length;
    expect(passed).toBeGreaterThanOrEqual(1);
    expect(passed).toBeLessThanOrEqual(10); // tidigare kod nollställde fönstret och släppte igenom alla
    const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(bucket?.count).toBe(25);
    await prisma.rateLimitBucket.delete({ where: { key } });
  });
});

describe("moms följer leveransdagen", () => {
  it("6 % t.o.m. 2027-12-31, därefter 12 %; andra satser orörda", () => {
    expect(effectiveVatRateBp(600, "2027-12-31")).toBe(600);
    expect(effectiveVatRateBp(600, "2028-01-01")).toBe(1200);
    expect(effectiveVatRateBp(2500, "2028-06-01")).toBe(2500);
    expect(effectiveVatRateBp(600, "")).toBe(600);
  });
});

describe("prenumerationskadens driver inte efter helgdag", () => {
  it("ankaret ligger kvar på varannan torsdag när en leverans flyttas", () => {
    const anchor = fromISODate("2026-05-14"); // Kristi himmelsfärd, torsdag
    const config = { weekdays: [4], leadTimeDays: 2 };
    expect(toISODate(snapToDeliveryWeekday(anchor, config))).toBe("2026-05-21"); // leveransen flyttas
    expect(toISODate(nextCadenceDate(anchor, "BIWEEKLY", [4]))).toBe("2026-05-28"); // kadensen inte
    expect(toISODate(snapToWeekday(fromISODate("2026-05-12"), [4]))).toBe("2026-05-14"); // tisdag → torsdag, även helgdag
  });
  it("listSv", () => {
    expect(listSv(["torsdag"])).toBe("torsdag");
    expect(listSv(["tisdag", "torsdag"])).toBe("tisdag och torsdag");
    expect(listSv(["måndag", "onsdag", "torsdag"])).toBe("måndag, onsdag och torsdag");
  });
});

describe("delkrediteringar summerar exakt till fakturan", () => {
  it("tre krediteringar à 1 kg av 3 kg à 123,45 kr ger fakturans moms, inte 1 öre mer", async () => {
    const product = await prisma.product.create({
      data: { slug: `test-ore-${Date.now()}`, name: "Öresprodukt", description: "test", pricePerKgOre: 12345, vatRateBp: 600, unit: "kg", active: true, sortOrder: 99 },
    });
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
    const date = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 6)[5]);
    const { order, invoice } = await createOrder(
      {
        items: [{ productId: product.id, weightKg: 3 }],
        areaSlug: "tyreso", deliveryDate: date,
        companyName: "Öresbolaget AB", orgNumber: orgNumber("557300889"), contactName: "Öre Öresson",
        email: "ore@testbolaget.se", phone: "0700000000", deliveryAddress: "Öregatan 1", deliveryPostalCode: "135 48",
        deliveryCity: "Tyresö", deliveryInstruction: "", invoiceEmail: "ore@testbolaget.se", reference: "", billingAddress: "",
      },
      { skipEmails: true }
    );
    expect(invoice.subtotalOre).toBe(37035);
    expect(invoice.vatOre).toBe(2222);
    for (let i = 0; i < 3; i++) {
      await issueCreditNote(invoice.id, "test", { lines: [{ lineIndex: 0, qty: 1 }], reason: "test" });
    }
    const notes = await prisma.creditNote.findMany({ where: { invoiceId: invoice.id } });
    expect(notes.length).toBe(3);
    expect(notes.reduce((s, n) => s + n.vatOre, 0)).toBe(-2222);
    expect(notes.reduce((s, n) => s + n.totalOre, 0)).toBe(-(invoice.totalOre));
    const closed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(closed.status).toBe("CREDITED");
    // Redan stängd: hel kreditering returnerar befintlig not med reused-flagga.
    const again = await issueCreditNote(invoice.id, "test");
    expect(again?.reused).toBe(true);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    await prisma.product.update({ where: { id: product.id }, data: { active: false } });
  });
});
