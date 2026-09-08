import { beforeAll, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string; type: string }[] = [];
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (msg: { to: string; subject: string; text: string; type: string }) => {
    sent.push(msg);
    return true;
  }),
}));

import { prisma } from "@/lib/db";
import { createSubscription } from "@/lib/subscriptions/service";
import { cancelByToken, getSubscriptionByToken, pauseByToken, resumeByToken, skipNextByToken, updateByToken, manageUrl } from "@/lib/subscriptions/manage";
import { addDays, nextCadenceDate, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import type { SubscriptionInput } from "@/lib/validation";
import { orgNumber } from "./helpers";

let productIds: string[] = [];
let firstDate = "";
let seq = 800;

function subInput(): SubscriptionInput {
  seq++;
  return {
    items: [{ productId: productIds[0], weightKg: 2 }],
    frequency: "BIWEEKLY",
    areaSlug: "nacka",
    firstDeliveryDate: firstDate,
    companyName: "Självservicebolaget AB",
    orgNumber: orgNumber(`${556700 + seq}223`),
    contactName: "Själv Service",
    email: `sjalv-${seq}@granskning.se`,
    phone: "070-123 45 67",
    deliveryAddress: "Självvägen 1",
    deliveryPostalCode: "131 30",
    deliveryCity: "Nacka",
    deliveryInstruction: "",
    invoiceEmail: `sjalv-${seq}@granskning.se`,
    reference: "",
  };
}

beforeAll(async () => {
  const products = await prisma.product.findMany({ where: { unit: "kg", active: true }, orderBy: { sortOrder: "asc" } });
  productIds = products.map((p) => p.id);
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
  firstDate = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 4)[3]);
});

describe("självservice via personlig länk", () => {
  it("token skapas vid start och står i bekräftelsen; ogiltig token ger null", async () => {
    const { subscription } = await createSubscription(subInput());
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(sub.manageToken).toMatch(/^[a-f0-9]{48}$/);
    expect(await getSubscriptionByToken("x".repeat(48))).toBeNull();
    expect(await getSubscriptionByToken("0".repeat(48))).toBeNull();
    expect((await getSubscriptionByToken(sub.manageToken!))?.id).toBe(sub.id);
    expect(manageUrl(sub.manageToken!)).toContain(`/prenumeration/hantera/${sub.manageToken}`);
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
  });

  it("hoppa över flyttar ett kadenssteg, paus/återuppta mejlar, ändring sparas, avslut låser", async () => {
    const { subscription } = await createSubscription(subInput());
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id }, include: { deliveryArea: true } });
    const token = sub.manageToken!;
    sent.length = 0;

    const skipped = await skipNextByToken(token);
    expect(skipped.ok).toBe(true);
    const afterSkip = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    const expected = nextCadenceDate(sub.nextDeliveryDate, "BIWEEKLY", JSON.parse(sub.deliveryArea!.weekdaysJson));
    expect(toISODate(afterSkip.nextDeliveryDate)).toBe(toISODate(expected));
    expect(sent.some((m) => m.type === "SUBSCRIPTION_CHANGE" && m.subject.includes("ny leveransdag"))).toBe(true);

    const paused = await pauseByToken(token);
    expect(paused.ok).toBe(true);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("PAUSED");
    expect(sent.some((m) => m.subject.includes("är pausad"))).toBe(true);
    // Hoppa över kräver aktiv prenumeration.
    expect((await skipNextByToken(token)).ok).toBe(false);

    // Återuppta: aldrig tidigare än kassans framförhållning.
    await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: addDays(new Date(), -30) } });
    const resumed = await resumeByToken(token);
    expect(resumed.ok).toBe(true);
    const afterResume = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(afterResume.status).toBe("ACTIVE");
    expect(afterResume.nextDeliveryDate.getTime()).toBeGreaterThan(Date.now());
    expect(sent.some((m) => m.subject.includes("igång igen"))).toBe(true);

    const updated = await updateByToken(token, "WEEKLY", [{ productId: productIds[0], weightKg: 3 }, { productId: productIds[1], weightKg: 0 }]);
    expect(updated.ok, JSON.stringify(updated)).toBe(true);
    const afterUpdate = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id }, include: { items: true } });
    expect(afterUpdate.frequency).toBe("WEEKLY");
    expect(afterUpdate.items).toHaveLength(1);
    expect(afterUpdate.items[0].weightKg).toBe(3);
    expect((await updateByToken(token, "WEEKLY", [])).ok).toBe(false);
    expect((await updateByToken(token, "DAILY", [{ productId: productIds[0], weightKg: 1 }])).ok).toBe(false);
    // Alla mejl bär hanteringslänken.
    expect(sent.filter((m) => m.type === "SUBSCRIPTION_CHANGE").every((m) => m.text.includes(`/prenumeration/hantera/${token}`))).toBe(true);

    const cancelled = await cancelByToken(token);
    expect(cancelled.ok).toBe(true);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("CANCELLED");
    expect((await pauseByToken(token)).ok).toBe(false);
    expect((await resumeByToken(token)).ok).toBe(false);
  });
});
