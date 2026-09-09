import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create-order";
import { fromISODate, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import { lockDeliveryDate } from "@/lib/warehouse/lock";
import { applyOrderPick, applyOrderUnpick, reservedGramsByProduct } from "@/lib/warehouse/inventory";
import { setPickStatus } from "@/lib/warehouse/pick";
import { parseSnapshot } from "@/lib/warehouse/snapshot";
import { isDeliveryDateClosed } from "@/lib/warehouse/closed";
import type { CheckoutInput } from "@/lib/validation";
import { orgNumber } from "./helpers";

let products: { id: string; slug: string }[] = [];
let validDate = "";
let seq = 0;

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  seq++;
  return {
    items: [{ productId: products.find((p) => p.slug === "kolasnittar")!.id, weightKg: 2 }],
    areaSlug: "tyreso",
    deliveryDate: validDate,
    companyName: `Lagerbolaget ${seq} AB`,
    orgNumber: orgNumber(`${557100 + seq}889`),
    contactName: "Lager Test",
    email: `lager${seq}@testforetaget.se`,
    phone: "070-123 45 67",
    deliveryAddress: "Testgatan 1",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "",
    invoiceEmail: `lager-faktura${seq}@testforetaget.se`,
    reference: "",
    billingAddress: "",
    ...overrides,
  };
}

beforeAll(async () => {
  products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  const dates = upcomingDeliveryDates(
    { weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays },
    4
  );
  // Välj ett datum som inte redan är cutoff-stängt (hoppa till nästa öppna).
  let chosen = dates[0];
  for (const d of dates) {
    if (!(await isDeliveryDateClosed(d))) {
      chosen = d;
      break;
    }
  }
  validDate = toISODate(chosen);
});

describe("lager och leveransvecka (integration)", () => {
  it("plock minskar fysiskt lager en gång och avplock återställer", async () => {
    const kol = products.find((p) => p.slug === "kolasnittar")!;
    await prisma.inventory.upsert({
      where: { productId: kol.id },
      create: { productId: kol.id, physicalGrams: 20000, minGrams: 0 },
      update: { physicalGrams: 20000 },
    });
    const { order } = await createOrder(
      input({ items: [{ productId: kol.id, weightKg: 3 }] }),
      { skipEmails: true }
    );
    const before = await prisma.inventory.findUniqueOrThrow({ where: { productId: kol.id } });
    await applyOrderPick(order.id, "test@example.com");
    const afterPick = await prisma.inventory.findUniqueOrThrow({ where: { productId: kol.id } });
    expect(afterPick.physicalGrams).toBe(before.physicalGrams - 3000);
    await applyOrderPick(order.id, "test@example.com"); // idempotent
    const again = await prisma.inventory.findUniqueOrThrow({ where: { productId: kol.id } });
    expect(again.physicalGrams).toBe(afterPick.physicalGrams);
    await applyOrderUnpick(order.id, "test@example.com");
    const restored = await prisma.inventory.findUniqueOrThrow({ where: { productId: kol.id } });
    expect(restored.physicalGrams).toBe(before.physicalGrams);
  });

  it("reserverat räknas från olevererade, oplockade ordrar", async () => {
    const kol = products.find((p) => p.slug === "kolasnittar")!;
    const before = await reservedGramsByProduct();
    const { order } = await createOrder(
      input({ items: [{ productId: kol.id, weightKg: 1 }] }),
      { skipEmails: true }
    );
    const after = await reservedGramsByProduct();
    expect((after.get(kol.id) ?? 0) - (before.get(kol.id) ?? 0)).toBe(1000);
    await setPickStatus(order.id, "PICKED", "test@example.com");
    const picked = await reservedGramsByProduct();
    expect(picked.get(kol.id) ?? 0).toBe(after.get(kol.id)! - 1000);
  });

  it("låser idempotent, skapar snapshot och skickar inte mejl två gånger", async () => {
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
    const dates = upcomingDeliveryDates(
      { weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays },
      8
    );
    let lockDate = dates[dates.length - 1];
    for (const d of [...dates].reverse()) {
      if (!(await isDeliveryDateClosed(d)) && toISODate(d) !== validDate) {
        lockDate = d;
        break;
      }
    }
    const iso = toISODate(lockDate);
    const a = await createOrder(input({ deliveryDate: iso }), { skipEmails: true });
    const date = fromISODate(iso);
    const first = await lockDeliveryDate(date, "test@example.com", { sendEmail: false });
    expect(first.status).toBe("LOCKED");
    expect(first.error).toBeUndefined();

    const week = await prisma.deliveryWeek.findUniqueOrThrow({ where: { deliveryDate: date } });
    const snap = parseSnapshot(week.snapshotJson);
    expect(snap).not.toBeNull();
    expect(snap!.stops.some((s) => s.orderNumber === a.order.orderNumber)).toBe(true);

    const second = await lockDeliveryDate(date, "test@example.com", { sendEmail: false });
    expect(second.alreadyLocked).toBe(true);
    const week2 = await prisma.deliveryWeek.findUniqueOrThrow({ where: { deliveryDate: date } });
    expect(week2.snapshotJson).toBe(week.snapshotJson);
  });
});
