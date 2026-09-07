import { beforeAll, describe, expect, it, vi } from "vitest";

// Mejlen fångas i minnet så att brödtexten kan kontrolleras – e-postloggen
// sparar bara ämnesraden.
const sent: { to: string; subject: string; text: string; type: string }[] = [];
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (msg: { to: string; subject: string; text: string; type: string }) => {
    sent.push(msg);
    return true;
  }),
}));

import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create-order";
import { sendOrderEmails } from "@/lib/orders/order-emails";
import { createSubscription, generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { projectedSubscriptionKgByDate } from "@/lib/orders/capacity";
import { issueCreditNote } from "@/lib/invoice/credit";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { addDays, fromISODate, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import type { SubscriptionInput } from "@/lib/validation";
import { orgNumber } from "./helpers";

let productIds: string[] = [];
let nackaDate = "";
let seq = 900;

function subInput(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
  seq++;
  return {
    items: [{ productId: productIds[0], weightKg: 2 }],
    frequency: "BIWEEKLY",
    areaSlug: "nacka",
    firstDeliveryDate: nackaDate,
    companyName: "Granskningsbolaget AB",
    orgNumber: orgNumber(`${556300 + seq}223`),
    contactName: "Gran Skare",
    email: `g6-${seq}@granskning.se`,
    phone: "070-123 45 67",
    deliveryAddress: "Granskningsvägen 6",
    deliveryPostalCode: "131 30",
    deliveryCity: "Nacka",
    deliveryInstruction: "Portkod 1234",
    invoiceEmail: `g6-faktura-${seq}@granskning.se`,
    reference: "",
    ...overrides,
  };
}

beforeAll(async () => {
  const products = await prisma.product.findMany({ where: { unit: "kg", active: true }, orderBy: { sortOrder: "asc" } });
  productIds = products.map((p) => p.id);
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
  nackaDate = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 3)[2]);
});

describe("prenumerationsorder – mejl och faktura", () => {
  it("orderbekräftelsen säger att det är en prenumerationsleverans och fakturan bär prenumerationsnummer + leveransadress", async () => {
    const { subscription } = await createSubscription(subInput());
    sent.length = 0;
    // Kör generatorn "två dagar före" första leveransen så att den är inom horisonten.
    const now = new Date(`${toISODate(addDays(fromISODate(nackaDate), -2))}T10:00:00.000Z`);
    const result = await generateDueSubscriptionOrders({ now });
    const generated = result.generated.find((g) => g.subscriptionNumber === subscription.number);
    expect(generated, JSON.stringify(result.skipped)).toBeTruthy();

    const confirmation = sent.find((m) => m.type === "ORDER_CONFIRMATION" && m.subject.includes(subscription.number));
    expect(confirmation).toBeTruthy();
    expect(confirmation!.subject).toMatch(/^Fikaleverans /);
    expect(confirmation!.text).toContain(`Fikaprenumeration: ${subscription.number}`);
    expect(confirmation!.text).toContain("gäller från nästa leverans");
    expect(confirmation!.text).toContain("Leveransanvisning: Portkod 1234");
    expect(confirmation!.text).not.toContain("Tack för er beställning");

    // Adminnotisen skickas bara när ADMIN_NOTIFY_EMAIL är satt (inte i testmiljön).
    const admin = sent.find((m) => m.type === "ADMIN_NEW_ORDER" && m.subject.includes(subscription.number));
    if (admin) expect(admin.subject).toMatch(/^Prenumerationsorder /);

    const order = await prisma.order.findFirstOrThrow({ where: { orderNumber: generated!.orderNumber }, include: { invoice: true } });
    const snapshot = parseSnapshot(order.invoice!.snapshotJson);
    expect(snapshot.subscriptionNumber).toBe(subscription.number);
    expect(snapshot.deliveryAddress).toBe("Granskningsvägen 6, 131 30 Nacka");

    const invoiceMail = sent.find((m) => m.type === "INVOICE" && m.subject.includes(order.invoice!.invoiceNumber));
    expect(invoiceMail?.text).toContain(`fikaprenumeration ${subscription.number}`);
    expect(invoiceMail?.text).toContain(`Referens vid betalning: ${order.invoice!.invoiceNumber}`);
    // Platshållare får aldrig läcka ut i mejl.
    expect(invoiceMail?.text).not.toContain("EJ VERIFIERAT");

    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED" } });
  });

  it("säger att fristen passerat i stället för att ange ett datum som redan gått", async () => {
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
    const soon = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 1)[0]);
    seq++;
    const { order } = await createOrder(
      {
        items: [{ productId: productIds[0], weightKg: 1 }],
        areaSlug: "nacka",
        deliveryDate: soon,
        companyName: "Fristbolaget AB",
        orgNumber: orgNumber(`${556400 + seq}223`),
        contactName: "Frist Person",
        email: `frist-${seq}@granskning.se`,
        phone: "070-123 45 67",
        deliveryAddress: "Fristvägen 1",
        deliveryPostalCode: "131 30",
        deliveryCity: "Nacka",
        deliveryInstruction: "",
        invoiceEmail: `frist-${seq}@granskning.se`,
        reference: "",
        billingAddress: "",
      },
      { skipEmails: true }
    );
    // Flytta leveransen till i morgon: fristen (två arbetsdagar före kl 12) är då passerad.
    await prisma.order.update({ where: { id: order.id }, data: { deliveryDate: addDays(new Date(new Date().toISOString().slice(0, 10)), 1) } });
    sent.length = 0;
    await sendOrderEmails(order.id);
    const confirmation = sent.find((m) => m.type === "ORDER_CONFIRMATION");
    expect(confirmation?.text).toContain("kan inte längre ändras");
    expect(confirmation?.text).not.toMatch(/senast \S+ \d+ \w+ kl/);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  });
});

describe("kapacitet reserverar prenumerationsvolym", () => {
  it("en aktiv prenumeration utan skapad order räknas in i dagens kilo", async () => {
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "haninge" } });
    const date = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 10)[9]);
    const sub = await prisma.subscription.create({
      data: {
        number: `PREN-G6-${Date.now()}`,
        companyName: "Reservbolaget AB",
        orgNumber: orgNumber("557299889"),
        contactName: "Res Erv",
        email: "reserv@granskning.se",
        deliveryAddress: "Reservgatan 1",
        deliveryPostalCode: "136 40",
        deliveryCity: "Haninge",
        deliveryAreaId: area.id,
        invoiceEmail: "reserv@granskning.se",
        frequency: "WEEKLY",
        nextDeliveryDate: fromISODate(date),
        items: { create: [{ productId: productIds[0], weightKg: 5 }] },
      },
    });
    try {
      const projected = await projectedSubscriptionKgByDate(area.id, [date]);
      expect(projected.get(date)).toBe(5);
      // Pausad prenumeration reserverar inget.
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED" } });
      expect((await projectedSubscriptionKgByDate(area.id, [date])).get(date)).toBeUndefined();
    } finally {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
    }
  });
});

describe("kreditfaktura", () => {
  it("bär återstående belopp och originalfakturans uppgifter, och mejlar även beställaren", async () => {
    seq++;
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
    const date = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 2)[1]);
    const { order, invoice } = await createOrder(
      {
        items: [{ productId: productIds[0], weightKg: 3 }],
        areaSlug: "nacka",
        deliveryDate: date,
        companyName: "Kreditbolaget AB",
        orgNumber: orgNumber(`${556500 + seq}223`),
        contactName: "Kred It",
        email: `kredit-${seq}@granskning.se`,
        phone: "070-123 45 67",
        deliveryAddress: "Kreditvägen 1",
        deliveryPostalCode: "131 30",
        deliveryCity: "Nacka",
        deliveryInstruction: "",
        invoiceEmail: `kredit-faktura-${seq}@granskning.se`,
        reference: "",
        billingAddress: "",
      },
      { skipEmails: true }
    );
    sent.length = 0;
    const credit = await issueCreditNote(invoice.id, "test", { lines: [{ lineIndex: 0, qty: 1 }], reason: "En kilo saknades i leveransen" });
    expect(credit && !credit.reused).toBeTruthy();
    const snapshot = parseSnapshot(credit!.snapshotJson);
    expect(snapshot.creditKind).toBe("PARTIAL");
    expect(snapshot.remainingToPayOre).toBe(invoice.totalOre + credit!.totalOre);
    expect(snapshot.creditedInvoiceTotalOre).toBe(invoice.totalOre);
    expect(snapshot.creditedInvoiceDate).toBeTruthy();
    const pdf = await renderInvoicePdf(snapshot, credit!.creditNumber);
    expect(pdf.length).toBeGreaterThan(1000);
    const flagged = await renderInvoicePdf(parseSnapshot(invoice.snapshotJson), invoice.invoiceNumber, { statusNote: "Delvis krediterad" });
    expect(flagged.length).toBeGreaterThan(1000);
    const recipients = sent.filter((m) => m.type === "CREDIT_NOTE").map((m) => m.to);
    expect(recipients).toContain(`kredit-faktura-${seq}@granskning.se`);
    expect(recipients).toContain(`kredit-${seq}@granskning.se`);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  });
});
