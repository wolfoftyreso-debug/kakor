import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder, ABUSE_LIMITS } from "@/lib/orders/create-order";
import { createSubscription, generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { checkoutSchema, subscriptionSchema } from "@/lib/validation";
import { addDays, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import { issueCreditNote } from "@/lib/invoice/credit";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { rateLimit, rateLimitMemory } from "@/lib/rate-limit";
import type { CheckoutInput } from "@/lib/validation";
import { orgNumber } from "./helpers";

// Regressionstester för fynden i den fullständiga granskningen (säkerhet +
// affärslogik). Riktig databas — samma motor som produktion.

let products: { id: string; name: string; pricePerKgOre: number }[] = [];
let validDate = "";
let n = 0;

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  n++;
  return {
    items: [{ productId: products[0].id, weightKg: 1 }],
    areaSlug: "tyreso",
    deliveryDate: validDate,
    companyName: "Granskningsbolaget AB",
    orgNumber: orgNumber("556100000"),
    contactName: "Test Person",
    email: `granskning${n}@example.com`,
    phone: "070-123 45 67",
    deliveryAddress: "Testgatan 1",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "",
    invoiceEmail: `granskning${n}@example.com`,
    reference: "",
    billingAddress: "",
    ...overrides,
  };
}

function subInput(key: string) {
  return {
    idempotencyKey: key,
    items: [{ productId: products[0].id, weightKg: 1 }],
    frequency: "BIWEEKLY" as const,
    areaSlug: "nacka",
    firstDeliveryDate: toISODate(upcomingDeliveryDates({ weekdays: [4], leadTimeDays: 2 }, 1)[0]),
    companyName: "Replay AB",
    orgNumber: orgNumber("556300222"),
    contactName: "Replay Person",
    email: `replay-${key}@example.com`,
    phone: "070-123 45 67",
    deliveryAddress: "Replayvägen 1",
    deliveryPostalCode: "131 30",
    deliveryCity: "Nacka",
    deliveryInstruction: "",
    invoiceEmail: `replay-${key}@example.com`,
    reference: "",
  };
}

beforeAll(async () => {
  products = await prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  validDate = toISODate(
    upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 1)[0]
  );
});

describe("validering", () => {
  const base = () => ({ ...input(), idempotencyKey: "abcdefghijklmnop1234" });

  it("avvisar kalenderfel datum (2026-13-45, 2026-02-30) som fältfel — inte 500", () => {
    for (const bad of ["2026-13-45", "2026-02-30", "2026-00-10"]) {
      const r = checkoutSchema.safeParse({ ...base(), deliveryDate: bad });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toEqual(["deliveryDate"]);
    }
  });

  it("kollapsar radbrytningar/kontrolltecken i enradsfält (PDF-skydd)", () => {
    const nl = String.fromCharCode(10);
    const cr = String.fromCharCode(13);
    const tab = String.fromCharCode(9);
    const r = checkoutSchema.safeParse({ ...base(), companyName: `Bolag${nl}${nl}${tab}AB${cr}${nl}x` });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.companyName).toBe("Bolag AB x");
  });

  it("tillåter radbrytningar men begränsar antal rader i kommentar", () => {
    const nl = String.fromCharCode(10);
    const r = checkoutSchema.safeParse({ ...base(), deliveryInstruction: ["a", "b", "c", "d", "e", "f", "g", "h"].join(nl) });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deliveryInstruction.split(nl)).toHaveLength(6);
  });

  it("honeypot: ifyllt sb_extra-fält avvisas", () => {
    expect(checkoutSchema.safeParse({ ...base(), sb_extra: "http://spam.example" }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...subInput("abcdefghijklmnop1234"), sb_extra: "x" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base(), sb_extra: "" }).success).toBe(true);
  });
});

describe("ordermotor — idempotens och prisspärr", () => {
  it("samma nyckel + annan payload avvisas (IDEMPOTENCY_MISMATCH), ordern återanvänds inte", async () => {
    const key = `audit-mismatch-${Date.now()}`;
    const first = await createOrder(input({ idempotencyKey: key }), { skipEmails: true });
    await expect(
      createOrder(input({ idempotencyKey: key, companyName: "Annat Bolag AB" }), { skipEmails: true })
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_MISMATCH" });
    const again = await createOrder(
      input({ idempotencyKey: key, email: first.order.email, invoiceEmail: first.order.invoiceEmail }),
      { skipEmails: true }
    );
    expect(again.order.id).toBe(first.order.id);
  });

  it("expectedTotalOre som avviker från serverns summa ger PRICE_CHANGED utan order", async () => {
    const before = await prisma.order.count();
    await expect(createOrder(input({ expectedTotalOre: 1 }), { skipEmails: true })).rejects.toMatchObject({
      code: "PRICE_CHANGED",
    });
    expect(await prisma.order.count()).toBe(before);
    const price = products[0].pricePerKgOre;
    const ok = await createOrder(input({ expectedTotalOre: Math.round(price * 1.12) }), { skipEmails: true });
    expect(ok.order.totalOre).toBe(Math.round(price * 1.12));
  });

  it("missbruksspärr: fler än gränsen per e-post och dygn avvisas (TOO_MANY)", async () => {
    const email = `spam-${Date.now()}@example.com`;
    for (let i = 0; i < ABUSE_LIMITS.perEmail; i++) {
      await createOrder(input({ email, invoiceEmail: email, orgNumber: orgNumber(`55620${i}000`) }), { skipEmails: true });
    }
    await expect(
      createOrder(input({ email, invoiceEmail: email, orgNumber: orgNumber("556299000") }), { skipEmails: true })
    ).rejects.toMatchObject({ code: "TOO_MANY" });
  });
});

describe("kreditfaktura", () => {
  it("avbruten order krediteras: nytt nummer i serien, original CREDITED, PDF renderas", async () => {
    const { order, invoice } = await createOrder(input(), { skipEmails: true });
    const credit = await issueCreditNote(invoice.id, "test");
    expect(credit).not.toBeNull();
    expect(Number(credit!.creditNumber)).toBeGreaterThan(Number(invoice.invoiceNumber));
    expect(credit!.totalOre).toBe(-invoice.totalOre);
    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("CREDITED");
    const snapshot = parseSnapshot(credit!.snapshotJson);
    expect(snapshot.creditsInvoiceNumber).toBe(invoice.invoiceNumber);
    const pdf = await renderInvoicePdf(snapshot, credit!.creditNumber);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    // Idempotent: andra anropet returnerar samma kreditfaktura.
    const again = await issueCreditNote(invoice.id, "test");
    expect(again!.id).toBe(credit!.id);
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id, type: "CREDITED" } });
    expect(events).toHaveLength(1);
  });
});

describe("PDF — paginering", () => {
  it("30 orderrader ger få sidor med sidfot på varje, aldrig 50", async () => {
    const { invoice } = await createOrder(input(), { skipEmails: true });
    const snapshot = parseSnapshot(invoice.snapshotJson);
    const line = snapshot.lines[0];
    snapshot.lines = Array.from({ length: 30 }, (_, i) => ({ ...line, productName: `Rad ${i + 1}` }));
    const pdf = await renderInvoicePdf(snapshot, invoice.invoiceNumber);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(pages).toBeLessThanOrEqual(3);
  });
});

describe("prenumerationsgenerator — vakter", () => {
  it("prenumeration pausad längre än framflyttningsloopen ger ALDRIG bakdaterad order", async () => {
    const { subscription: sub } = await createSubscription({
      ...subInput(`langpaus-${Date.now()}`),
      frequency: "WEEKLY",
      companyName: "Långpaus AB",
    });
    const now = new Date();
    // 600 dagar bakåt: 60 veckosteg räcker inte fram till idag.
    await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: addDays(now, -600) } });
    const run = await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });
    expect(await prisma.order.count({ where: { subscriptionId: sub.id } })).toBe(0);
    expect(run.skipped.some((s) => s.subscriptionNumber === sub.number)).toBe(true);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.nextDeliveryDate.getTime()).toBeGreaterThan(addDays(now, -600).getTime());
  });

  it("createSubscription rapporterar duplicate vid replay och avvisar annan payload", async () => {
    const base = subInput(`audit-sub-${Date.now()}`);
    const a = await createSubscription(base);
    const b = await createSubscription(base);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.subscription.id).toBe(a.subscription.id);
    await expect(createSubscription({ ...base, companyName: "Annat AB" })).rejects.toMatchObject({
      code: "IDEMPOTENCY_MISMATCH",
    });
  });
});

describe("rate limiting — delad räknare", () => {
  it("spärrar efter gränsen i databasen", async () => {
    const key = `test-shared-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(key, { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    }
    const blocked = await rateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("minneslagret blockerar efter gränsen", () => {
    expect(rateLimitMemory("m1", { limit: 1, windowMs: 1000 }).ok).toBe(true);
    expect(rateLimitMemory("m1", { limit: 1, windowMs: 1000 }).ok).toBe(false);
  });
});
