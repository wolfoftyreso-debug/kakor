import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create-order";
import { sendDeliveryReminders } from "@/lib/orders/order-emails";
import { addDays, fromISODate, toISODate, todayInStockholm, upcomingDeliveryDates } from "@/lib/dates";
import { orgNumber } from "./helpers";

// Körs med log-providern (setup-env): e-postloggen skrivs på riktigt, och
// det är den som gör påminnelsen idempotent.

let productId = "";
let seq = 700;

beforeAll(async () => {
  const p = await prisma.product.findFirstOrThrow({ where: { unit: "kg", active: true }, orderBy: { sortOrder: "asc" } });
  productId = p.id;
});

describe("leveranspåminnelse dagen före", () => {
  it("mejlar ordrar med leverans i morgon en gång, aldrig avbrutna eller levererade", async () => {
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "nacka" } });
    const date = toISODate(upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 2)[1]);
    const make = async () => {
      seq++;
      return (
        await createOrder(
          {
            items: [{ productId, weightKg: 1 }],
            areaSlug: "nacka",
            deliveryDate: date,
            companyName: "Påminnelsebolaget AB",
            orgNumber: orgNumber(`${556600 + seq}223`),
            contactName: "På Minnelse",
            email: `paminnelse-${seq}@testbolaget.se`,
            phone: "070-123 45 67",
            deliveryAddress: "Påminnelsevägen 1",
            deliveryPostalCode: "131 30",
            deliveryCity: "Nacka",
            deliveryInstruction: "Portkod 4321",
            invoiceEmail: `paminnelse-${seq}@testbolaget.se`,
            reference: "",
            billingAddress: "",
          },
          { skipEmails: true }
        )
      ).order;
    };
    const a = await make();
    const cancelled = await make();
    const delivered = await make();
    // Simulera "i morgon" genom att köra med now = dagen före leveransdagen.
    const now = new Date(`${toISODate(addDays(fromISODate(date), -1))}T12:00:00.000Z`);
    await prisma.order.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });
    await prisma.order.update({ where: { id: delivered.id }, data: { deliveryStatus: "DELIVERED" } });

    const first = await sendDeliveryReminders(now);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    const second = await sendDeliveryReminders(now);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);

    const logs = await prisma.emailLog.findMany({ where: { type: "DELIVERY_REMINDER", orderId: { in: [a.id, cancelled.id, delivered.id] } } });
    expect(logs.filter((l) => l.orderId === a.id)).toHaveLength(1);
    expect(logs.some((l) => l.orderId === cancelled.id)).toBe(false);
    expect(logs.some((l) => l.orderId === delivered.id)).toBe(false);
    expect(logs[0].subject).toContain("I morgon kommer fikat");

    // Ingen påminnelse för dagar som inte är "i morgon".
    const wrongDay = await sendDeliveryReminders(new Date(`${toISODate(todayInStockholm())}T12:00:00.000Z`));
    expect(wrongDay.sent).toBe(0);
    await prisma.order.updateMany({ where: { id: { in: [a.id, delivered.id] } }, data: { status: "CANCELLED" } });
  });
});
