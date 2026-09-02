import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create-order";
import { createSubscription, generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { rateLimitShared } from "@/lib/rate-limit";
import { checkoutSchema, isValidOrgNumber } from "@/lib/validation";
import { addDays, toISODate, upcomingDeliveryDates, todayInStockholm } from "@/lib/dates";
import { orgNumber } from "./helpers";
import type { CheckoutInput } from "@/lib/validation";

// Revision 2: tester för sådant som tidigare bara antogs fungera.

let products: { id: string; pricePerKgOre: number }[] = [];
let validDate = "";
let n = 0;
function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  n++;
  return {
    items: [{ productId: products[0].id, weightKg: 1 }],
    areaSlug: "tyreso",
    deliveryDate: validDate,
    companyName: "Revisionsbolaget AB",
    orgNumber: orgNumber(`5565${String(n).padStart(5, "0")}`),
    contactName: "Rev Person",
    email: `rev${n}@example.com`,
    phone: "070-000 00 00",
    deliveryAddress: "Revgatan 1",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "",
    invoiceEmail: `rev${n}@example.com`,
    reference: "",
    billingAddress: "",
    ...overrides,
  };
}

beforeAll(async () => {
  products = await prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  validDate = toISODate(
    upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 1)[0]
  );
});

describe("organisationsnummer", () => {
  it("Luhn: giltiga passerar, påhittade avvisas", () => {
    expect(isValidOrgNumber("556677-8899")).toBe(true);
    expect(isValidOrgNumber("5566778899")).toBe(true);
    expect(isValidOrgNumber("556677-8890")).toBe(false);
    expect(isValidOrgNumber("556000-0000")).toBe(false);
    const r = checkoutSchema.safeParse({ ...input(), orgNumber: "556000-0000" });
    expect(r.success).toBe(false);
    const ok = checkoutSchema.safeParse({ ...input(), orgNumber: "5566778899" });
    expect(ok.success && ok.data.orgNumber).toBe("556677-8899");
  });
});

describe("samtidighet", () => {
  it("tre parallella anrop med samma idempotensnyckel ger exakt EN order och inga luckor i serien", async () => {
    const key = `rev-parallel-${Date.now()}`;
    const before = await prisma.counter.findUniqueOrThrow({ where: { name: "invoice" } });
    const payload = input({ idempotencyKey: key });
    const results = await Promise.all([
      createOrder(payload, { skipEmails: true }),
      createOrder(payload, { skipEmails: true }),
      createOrder(payload, { skipEmails: true }),
    ]);
    const ids = new Set(results.map((r) => r.order.id));
    expect(ids.size).toBe(1);
    const after = await prisma.counter.findUniqueOrThrow({ where: { name: "invoice" } });
    expect(after.value - before.value).toBe(1);
  });
});

describe("delad rate limit-räknare (databasen)", () => {
  it("blockerar efter gränsen oberoende av minneslagret", async () => {
    const key = `rev-shared-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      expect((await rateLimitShared(key, { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    }
    const blocked = await rateLimitShared(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("nytt fönster när resetAt passerats", async () => {
    const key = `rev-window-${Date.now()}`;
    await rateLimitShared(key, { limit: 1, windowMs: 60_000 });
    expect((await rateLimitShared(key, { limit: 1, windowMs: 60_000 })).ok).toBe(false);
    await prisma.rateLimitBucket.update({ where: { key }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await rateLimitShared(key, { limit: 1, windowMs: 60_000 })).ok).toBe(true);
  });
});

describe("cron-autentisering", () => {
  it("503 utan CRON_SECRET, 401 med fel Bearer, 200 med rätt", async () => {
    const { GET } = await import("@/app/api/cron/generate-subscription-orders/route");
    const url = "http://localhost/api/cron/generate-subscription-orders";
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect((await GET(new NextRequest(url))).status).toBe(503);
    process.env.CRON_SECRET = "test-hemlighet";
    expect((await GET(new NextRequest(url, { headers: { authorization: "Bearer fel" } }))).status).toBe(401);
    const ok = await GET(new NextRequest(url, { headers: { authorization: "Bearer test-hemlighet" } }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.ok).toBe(true);
    expect(typeof body.sweptRateLimitBuckets).toBe("number");
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });
});

describe("prenumerationsgenerator — framförhållning", () => {
  it("nästa datum inom framförhållningen flyttas fram — ingen order samma morgon", async () => {
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
    const { subscription: sub } = await createSubscription({
      items: [{ productId: products[0].id, weightKg: 1 }],
      frequency: "WEEKLY",
      areaSlug: "nacka",
      firstDeliveryDate: toISODate(
        upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 1)[0]
      ),
      companyName: "Framförhållning AB",
      orgNumber: orgNumber("556777000"),
      contactName: "Fram Person",
      email: `fram-${Date.now()}@example.com`,
      phone: "070-000 00 00",
      deliveryAddress: "Framvägen 1",
      deliveryPostalCode: "131 30",
      deliveryCity: "Nacka",
      deliveryInstruction: "",
      invoiceEmail: `fram-${Date.now()}@example.com`,
      reference: "",
    });
    // Sätt nästa leverans till "idag" (en giltig veckodag krävs inte — snappning sköter det).
    const now = new Date();
    await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: todayInStockholm(now) } });
    await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });
    const orders = await prisma.order.findMany({ where: { subscriptionId: sub.id } });
    const earliest = addDays(todayInStockholm(now), 1);
    for (const o of orders) expect(o.deliveryDate.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.nextDeliveryDate.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
  });
});
