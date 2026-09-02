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
let seq = 0; // unik kund per anrop — missbruksspärren ska inte slå till i sviten

function subscriptionInput(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
  seq++;
  return {
    items: [
      { productId: productIds[0], weightKg: 2 },
      { productId: productIds[1], weightKg: 1 },
    ],
    frequency: "BIWEEKLY",
    areaSlug: "nacka",
    firstDeliveryDate: firstDate,
    companyName: "Prenumerationsbolaget AB",
    orgNumber: `${556100 + seq}-2233`,
    contactName: "Prenumerant Person",
    email: `fika${seq}@prenbolaget.se`,
    phone: "",
    deliveryAddress: "Prenumerationsvägen 5",
    deliveryPostalCode: "131 30",
    deliveryCity: "Nacka",
    deliveryInstruction: "",
    invoiceEmail: `faktura${seq}@prenbolaget.se`,
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
    const { subscription: sub } = await createSubscription(subscriptionInput());
    expect(sub.number).toMatch(/^PREN-\d{4,}$/);
    expect(sub.status).toBe("ACTIVE");
    expect(sub.items).toHaveLength(2);
    expect(toISODate(sub.nextDeliveryDate)).toBe(firstDate);
  });

  it("genererar en vanlig order via ordermotorn och flyttar fram nästa leverans — idempotent", async () => {
    const { subscription: sub } = await createSubscription(subscriptionInput());
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
    const { subscription: sub } = await createSubscription(subscriptionInput());
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

  it("samma idempotencyKey ger samma prenumeration — aldrig två", async () => {
    const key = `test-sub-idem-${Date.now()}`;
    const same = { idempotencyKey: key, orgNumber: "556011-2233", email: "idem@prenbolaget.se", invoiceEmail: "idem@prenbolaget.se" };
    const { subscription: first } = await createSubscription(subscriptionInput(same));
    const { subscription: second } = await createSubscription(subscriptionInput(same));
    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);
    expect(await prisma.subscription.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it("passerat leveransdatum ger aldrig en bakdaterad order — framflyttat datum inom horisonten genereras", async () => {
    const { subscription: sub } = await createSubscription(subscriptionInput());
    // Simulera lång paus: nästa leverans ligger långt bak i tiden.
    const stale = addDays(sub.nextDeliveryDate, -60);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextDeliveryDate: stale },
    });

    const now = addDays(sub.nextDeliveryDate, -2);
    const run = await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });

    // Framflyttningen landar 2 dagar fram (inom horisonten) -> ordern skapas nu,
    // på det framflyttade datumet, aldrig på det passerade.
    const mine = run.generated.filter((g) => g.subscriptionNumber === sub.number);
    expect(mine).toHaveLength(1);
    expect(mine[0].deliveryDate >= toISODate(now)).toBe(true);
    const orders = await prisma.order.findMany({ where: { subscriptionId: sub.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0].deliveryDate.getTime()).toBeGreaterThanOrEqual(now.getTime());

    const reloaded = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(reloaded.nextDeliveryDate.getTime()).toBeGreaterThan(orders[0].deliveryDate.getTime());
  });

  it("passerat leveransdatum som flyttas fram bortom horisonten hoppas över med förklaring", async () => {
    const { subscription: sub } = await createSubscription(subscriptionInput());
    const stale = addDays(sub.nextDeliveryDate, -60);
    await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: stale } });

    // Horisont 0 dagar: det framflyttade datumet (2 dagar fram) ligger utanför.
    const now = addDays(sub.nextDeliveryDate, -2);
    const run = await generateDueSubscriptionOrders({ now, horizonDays: 0, skipEmails: true });

    expect(run.generated.filter((g) => g.subscriptionNumber === sub.number)).toHaveLength(0);
    expect(
      run.skipped.some((s) => s.subscriptionNumber === sub.number && /framflyttad/.test(s.reason))
    ).toBe(true);
    expect(await prisma.order.count({ where: { subscriptionId: sub.id } })).toBe(0);
    const reloaded = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(reloaded.nextDeliveryDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("avvisar postnummer utanför områdets prefixspärr", async () => {
    // Seeden lämnar spärren tom — aktivera den för testet och återställ efteråt.
    await prisma.deliveryArea.update({
      where: { slug: "nacka" },
      data: { postalCodePrefixesJson: '["131"]' },
    });
    try {
      await expect(
        createSubscription(subscriptionInput({ deliveryPostalCode: "999 99" }))
      ).rejects.toThrow(/Postnumret/);
    } finally {
      await prisma.deliveryArea.update({
        where: { slug: "nacka" },
        data: { postalCodePrefixesJson: "[]" },
      });
    }
  });
});
