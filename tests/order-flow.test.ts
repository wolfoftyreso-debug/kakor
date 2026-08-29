import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder, OrderError } from "@/lib/orders/create-order";
import { toISODate, upcomingDeliveryDates } from "@/lib/dates";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import type { CheckoutInput } from "@/lib/validation";

// Golden path (integration): riktig databas, riktig ordermotor, riktig PDF.

let products: { id: string; name: string; pricePerKgOre: number }[] = [];
let validDate = "";

function checkoutInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    items: [
      { productId: products[0].id, weightKg: 2 },
      { productId: products[1].id, weightKg: 1 },
    ],
    areaSlug: "tyreso",
    deliveryDate: validDate,
    companyName: "Testföretaget AB",
    orgNumber: "556677-8899",
    contactName: "Test Person",
    email: "kontakt@testforetaget.se",
    phone: "070-123 45 67",
    deliveryAddress: "Testgatan 1",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "Porten vid lastkajen",
    invoiceEmail: "faktura@testforetaget.se",
    reference: "Kostnadsställe 42",
    billingAddress: "",
    ...overrides,
  };
}

beforeAll(async () => {
  products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });
  expect(products.length).toBeGreaterThanOrEqual(3);
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  const dates = upcomingDeliveryDates(
    { weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays },
    2
  );
  validDate = toISODate(dates[0]);
});

describe("order + faktura (golden path)", () => {
  it("skapar order och faktura atomiskt med serverberäknade priser", async () => {
    const { order, invoice, duplicate } = await createOrder(checkoutInput(), { skipEmails: true });
    expect(duplicate).toBe(false);

    // Ordernummer enligt dokumenterad serie
    expect(order.orderNumber).toMatch(/^SB-\d{6}$/);
    // Fakturanummer: ren löpnummerserie
    expect(invoice.invoiceNumber).toMatch(/^\d{5,}$/);

    // Servern räknar priset från databasen — aldrig från klienten.
    const expectedSubtotal = 2 * products[0].pricePerKgOre + 1 * products[1].pricePerKgOre;
    expect(order.subtotalOre).toBe(expectedSubtotal);
    expect(order.vatOre).toBe(Math.round(2 * products[0].pricePerKgOre * 0.12) + Math.round(products[1].pricePerKgOre * 0.12));
    expect(order.totalOre).toBe(order.subtotalOre + order.vatOre);

    // Separata statusar
    expect(order.status).toBe("NEW");
    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.deliveryStatus).toBe("PENDING");

    // Snapshot är komplett och fristående
    const snapshot = parseSnapshot(invoice.snapshotJson);
    expect(snapshot.orderNumber).toBe(order.orderNumber);
    expect(snapshot.lines).toHaveLength(2);
    expect(snapshot.totalOre).toBe(order.totalOre);
    expect(snapshot.buyer.companyName).toBe("Testföretaget AB");
    expect(snapshot.seller.orgNumber).toBe("559141-7042");

    // Händelselogg skrevs
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events.some((e) => e.type === "CREATED")).toBe(true);

    // Säker nedladdningstoken
    expect(invoice.downloadToken).toMatch(/^[a-f0-9]{48}$/);
  });

  it("fakturans belopp ändras INTE när produktpriset ändras efteråt", async () => {
    const { order, invoice } = await createOrder(checkoutInput(), { skipEmails: true });
    const originalTotal = invoice.totalOre;

    await prisma.product.update({
      where: { id: products[0].id },
      data: { pricePerKgOre: 999900 },
    });
    try {
      const reloaded = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      const snapshot = parseSnapshot(reloaded.snapshotJson);
      expect(reloaded.totalOre).toBe(originalTotal);
      expect(snapshot.totalOre).toBe(originalTotal);
      const reloadedOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      expect(reloadedOrder.totalOre).toBe(originalTotal);
      expect(reloadedOrder.items[0].unitPricePerKgOre).toBe(products[0].pricePerKgOre);
    } finally {
      await prisma.product.update({
        where: { id: products[0].id },
        data: { pricePerKgOre: products[0].pricePerKgOre },
      });
    }
  });

  it("dubbelklick/retry med samma idempotensnyckel ger EN order", async () => {
    const key = "test-idempotency-key-0001";
    const first = await createOrder(checkoutInput({ idempotencyKey: key }), { skipEmails: true });
    const second = await createOrder(checkoutInput({ idempotencyKey: key }), { skipEmails: true });
    expect(second.duplicate).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(second.invoice.invoiceNumber).toBe(first.invoice.invoiceNumber);

    const count = await prisma.order.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("avvisar ogiltigt leveransdatum (passerat / fel veckodag)", async () => {
    await expect(
      createOrder(checkoutInput({ deliveryDate: "2020-01-01" }), { skipEmails: true })
    ).rejects.toThrow(OrderError);
  });

  it("avvisar inaktiv produkt", async () => {
    await prisma.product.update({ where: { id: products[2].id }, data: { active: false } });
    try {
      await expect(
        createOrder(checkoutInput({ items: [{ productId: products[2].id, weightKg: 1 }] }), {
          skipEmails: true,
        })
      ).rejects.toThrow(/finns inte längre/);
    } finally {
      await prisma.product.update({ where: { id: products[2].id }, data: { active: true } });
    }
  });

  it("avvisar okänt leveransområde", async () => {
    await expect(
      createOrder(checkoutInput({ areaSlug: "solna" }), { skipEmails: true })
    ).rejects.toThrow(/Okänt leveransområde/);
  });

  it("ordernummer och fakturanummer är strikt stigande utan dubbletter", async () => {
    const a = await createOrder(checkoutInput(), { skipEmails: true });
    const b = await createOrder(checkoutInput(), { skipEmails: true });
    const numA = parseInt(a.order.orderNumber.replace("SB-", ""), 10);
    const numB = parseInt(b.order.orderNumber.replace("SB-", ""), 10);
    expect(numB).toBe(numA + 1);
    expect(parseInt(b.invoice.invoiceNumber, 10)).toBe(parseInt(a.invoice.invoiceNumber, 10) + 1);
  });

  it("genererar en riktig PDF från fakturans snapshot", async () => {
    const { invoice } = await createOrder(checkoutInput(), { skipEmails: true });
    const pdf = await renderInvoicePdf(parseSnapshot(invoice.snapshotJson), invoice.invoiceNumber);
    expect(pdf.length).toBeGreaterThan(1500);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("loggar e-post i EmailLog utan att fälla ordern", async () => {
    const { order } = await createOrder(checkoutInput(), { skipEmails: false });
    const logs = await prisma.emailLog.findMany({ where: { orderId: order.id } });
    expect(logs.length).toBe(2); // orderbekräftelse + faktura
    expect(logs.every((l) => l.status === "SENT")).toBe(true);
    expect(logs.map((l) => l.type).sort()).toEqual(["INVOICE", "ORDER_CONFIRMATION"]);
  });
});
