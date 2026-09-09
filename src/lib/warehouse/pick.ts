import { prisma } from "@/lib/db";
import { canTransitionPick, isWeekLockedStatus } from "@/lib/status";
import { sendDeliveryConfirmationEmail } from "@/lib/orders/order-emails";
import { applyOrderPick, applyOrderUnpick } from "./inventory";
import { parseSnapshot } from "./snapshot";

export class PickError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Lagerprincip: fysiskt saldo minskas när ordern plockas (kakorna lämnar
 * frysen) och återställs vid avplock. Leverans markerar bara att stoppet
 * är klart – ingen andra dragning.
 */
export async function setPickStatus(orderId: string, to: string, actor: string): Promise<{ pickStatus: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new PickError("Ordern finns inte");
  if (order.status === "CANCELLED") throw new PickError("Avbruten order plockas inte");
  if (order.deliveryStatus === "DELIVERED" && to !== "DELIVERED") {
    throw new PickError("Levererad order kan inte backas via plockstatus");
  }
  const from = order.pickStatus;
  if (from === to) return { pickStatus: from };
  if (!canTransitionPick(from, to)) {
    throw new PickError("Otillåten plockövergång");
  }

  await prisma.$transaction(async (tx) => {
    if (to === "PICKED" && from === "UNPICKED") {
      await applyOrderPick(orderId, actor, tx);
    } else if (to === "PICKED" && from === "PROBLEM") {
      await applyOrderPick(orderId, actor, tx);
    } else if (to === "UNPICKED" && (from === "PICKED" || from === "PROBLEM")) {
      await applyOrderUnpick(orderId, actor, tx);
    } else if (to === "PROBLEM" && from === "PICKED") {
      // Problem efter plock: kakorna är ute ur frysen tills någon avplockar.
    } else if (to === "PROBLEM" && from === "LOADED") {
      // Lastad → problem: inventariet är redan draget.
    } else if (to === "PICKED" && from === "LOADED") {
      // Lastad tillbaka till plockad: ingen lagerändring.
    }

    const data: { pickStatus: string; deliveryStatus?: string; deliveredAt?: Date; status?: string } = { pickStatus: to };
    if (to === "DELIVERED") {
      data.deliveryStatus = "DELIVERED";
      data.deliveredAt = new Date();
      if (order.status === "NEW") data.status = "CONFIRMED";
    }
    const res = await tx.order.updateMany({
      where: { id: orderId, pickStatus: from, status: { not: "CANCELLED" } },
      data,
    });
    if (res.count !== 1) throw new PickError("Ordern ändrades samtidigt av någon annan – ladda om sidan");
    await tx.orderEvent.create({
      data: {
        orderId,
        type: to === "DELIVERED" ? "DELIVERED" : "NOTE",
        message: pickEventMessage(from, to),
        actor,
      },
    });
  });

  if (to === "DELIVERED") {
    let mailed = false;
    try {
      mailed = await sendDeliveryConfirmationEmail(orderId);
    } catch (e) {
      console.error("Leveransbekräftelse misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
    }
    if (mailed) {
      await prisma.orderEvent.create({
        data: { orderId, type: "EMAIL", message: "Leveransbekräftelse skickad till kunden", actor: "system" },
      }).catch(() => {});
    }
  }

  await syncWeekStatusForDate(order.deliveryDate);
  return { pickStatus: to };
}

function pickEventMessage(from: string, to: string): string {
  if (to === "PICKED") return "Plockad ur frysen – lagret reducerat";
  if (to === "UNPICKED") return "Avplockad – lagret återställt";
  if (to === "LOADED") return "Lastad i bilen";
  if (to === "DELIVERED") return "Markerad som levererad";
  if (to === "PROBLEM") return `Markerad som problem (föregående status ${from})`;
  return `Plockstatus ${from} → ${to}`;
}

export async function syncWeekStatusForDate(deliveryDate: Date): Promise<void> {
  const week = await prisma.deliveryWeek.findUnique({ where: { deliveryDate } });
  if (!week || (!isWeekLockedStatus(week.status) && week.status !== "LOCKING")) return;
  if (week.status === "COMPLETED") return;

  const orders = await prisma.order.findMany({
    where: { deliveryDate, status: { not: "CANCELLED" } },
    select: { pickStatus: true, deliveryStatus: true },
  });
  if (orders.length === 0) return;

  const allDelivered = orders.every((o) => o.deliveryStatus === "DELIVERED" || o.pickStatus === "DELIVERED");
  const remaining = orders.filter((o) => o.deliveryStatus !== "DELIVERED" && o.pickStatus !== "DELIVERED");
  const allLoaded = remaining.length > 0 && remaining.every((o) => o.pickStatus === "LOADED");
  const anyPicked = orders.some((o) => o.pickStatus === "PICKED" || o.pickStatus === "LOADED" || o.pickStatus === "DELIVERED");

  let next = week.status;
  if (allDelivered) next = "COMPLETED";
  else if (allLoaded) next = "OUT_FOR_DELIVERY";
  else if (anyPicked) next = "PICKING";
  else if (parseSnapshot(week.snapshotJson)) next = "LOCKED";

  if (next !== week.status) {
    await prisma.deliveryWeek.update({ where: { id: week.id }, data: { status: next } });
  }
}
