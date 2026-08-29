import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createSubscription,
  generateDueSubscriptionOrders,
} from "@/lib/subscriptions/service";
import { addDays, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import type { SubscriptionInput } from "@/lib/validation";

let productIds: string[] = [];
let firstDate = "";

function subscriptionInput(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
    items: [
      { productId: productIds[0], weightKg: 2 },
      { productId: productIds[1], weightKg: 1 },
    ],
    frequency: "BIWEEKLY",
    areaSlug: "nacka",
    firstDeliveryDate: firstDate,
    companyName: "Prenumerationsbolaget AB",
    orgNumber: "556011-2233",
    contactName: "Prenumerant Person",
    email: "fika@prenbolaget.se",
    phone: "",
    deliveryAddress: "Prenumerationsvägen 5",
    deliveryPostalCode: "131 30",
    deliveryCity: "Nacka",
    deliveryInstruction: "",
    invoiceEmail: "faktura@prenbolaget.se",
    reference: "",
    ...overrides,
  };
}

beforeAll(async () => {
  const products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });
  productIds = products.map((p) => p.id);
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
  const dates = upcomingDeliveryDates(
    { weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays },
    1
  );
  firstDate = toISODate(dates[0]);
});

describe("prenumeration → order → faktura", () => {
  it("skapar prenumeration med nummer och rader", async () => {
    const sub = await createSubscription(subscriptionInput());
    expect(sub.number).toMatch(/^PREN-\d{4,}$/);
    expect(sub.status).toBe("ACTIVE");
    expect(sub.items).toHaveLength(2);
    expect(toISODate(sub.nextDeliveryDate)).toBe(firstDate);
  });

  it("genererar en vanlig order via ordermotorn och flyttar fram nästa leverans — idempotent", async () => {
    const sub = await createSubscription(subscriptionInput());
    // "Kör" generatorn strax före leveransdatumet.
    const now = addDays(sub.nextDeliveryDate, -2);

    const run1 = await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });
    const mine1 = run1.generated.filter((g) => g.subscriptionNumber === sub.number);
    expect(mine1).toHaveLength(1);
    expect(mine1[0].deliveryDate).toBe(firstDate);

    // Ordern är en helt vanlig order med faktura.
    const order = await prisma.order.findFirstOrThrow({
      where: { subscriptionId: sub.id },
      include: { invoice: true, items: true },
    });
    expect(order.orderNumber).toMatch(/^SB-\d{6}$/);
    expect(order.invoice).not.toBeNull();
    expect(order.items).toHaveLength(2);
    expect(order.subscriptionPeriod).toBe(firstDate);

    // Nästa leveransdatum flyttades fram 14 dagar (varannan vecka).
    const reloaded = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(reloaded.nextDeliveryDate.getTime()).toBeGreaterThan(sub.nextDeliveryDate.getTime());

    // Dubbelkörning för samma period får ALDRIG ge två ordrar.
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextDeliveryDate: sub.nextDeliveryDate },
    });
    const run2 = await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });
    const mine2 = run2.generated.filter((g) => g.subscriptionNumber === sub.number);
    expect(mine2).toHaveLength(0);
    expect(
      run2.skipped.some((s) => s.subscriptionNumber === sub.number && /redan genererad/.test(s.reason))
    ).toBe(true);

    const orderCount = await prisma.order.count({ where: { subscriptionId: sub.id } });
    expect(orderCount).toBe(1);
  });

  it("pausad prenumeration genererar inga ordrar", async () => {
    const sub = await createSubscription(subscriptionInput());
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED" } });
    const run = await generateDueSubscriptionOrders({
      now: addDays(sub.nextDeliveryDate, -2),
      horizonDays: 3,
      skipEmails: true,
    });
    expect(run.generated.filter((g) => g.subscriptionNumber === sub.number)).toHaveLength(0);
    expect(await prisma.order.count({ where: { subscriptionId: sub.id } })).toBe(0);
  });

  it("avvisar ogiltig första leveransdag", async () => {
    await expect(
      createSubscription(subscriptionInput({ firstDeliveryDate: "2020-01-01" }))
    ).rejects.toThrow(/inte tillgänglig/);
  });
});
