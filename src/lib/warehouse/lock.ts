import { prisma } from "@/lib/db";
import { addDays, fromISODate, toISODate, todayInStockholm } from "@/lib/dates";
import { isWeekLockedStatus } from "@/lib/status";
import { generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { describeError } from "@/lib/log";
import { isPastCutoff } from "./cutoff";
import { getOpsSettings, resolveOpsRecipients } from "./settings";
import { buildSnapshot, ensureDeliveryWeek, parseLateChanges, parseSnapshot } from "./snapshot";
import { sendLockEmail } from "./email";
import type { DeliverySnapshot } from "./types";

export { ensureDeliveryWeek };

export interface LockResult {
  deliveryDate: string;
  status: string;
  alreadyLocked: boolean;
  emailed: boolean;
  error?: string;
}

/**
 * Lås en leveransdag: OPEN → LOCKING → snapshot → LOCKED.
 * Andra körningen är en no-op (skickar mejl bara om det aldrig gick iväg).
 */
export async function lockDeliveryDate(
  deliveryDate: Date,
  actor: string,
  options: { sendEmail?: boolean } = {}
): Promise<LockResult> {
  const iso = toISODate(deliveryDate);
  const send = options.sendEmail !== false;
  const week = await ensureDeliveryWeek(deliveryDate);

  if (week.status === "LOCKING") {
    return finalizeLock(week.id, deliveryDate, actor, send);
  }
  if (isWeekLockedStatus(week.status)) {
    let emailed = !!week.opsEmailSentAt;
    if (send && !week.opsEmailSentAt) {
      const snapshot = parseSnapshot(week.snapshotJson);
      if (snapshot) emailed = await sendAndMark(week.id, snapshot);
    }
    return { deliveryDate: iso, status: week.status, alreadyLocked: true, emailed };
  }

  const claimed = await prisma.deliveryWeek.updateMany({
    where: { id: week.id, status: "OPEN" },
    data: { status: "LOCKING", lastError: "" },
  });
  if (claimed.count !== 1) {
    const again = await prisma.deliveryWeek.findUniqueOrThrow({ where: { id: week.id } });
    if (again.status === "LOCKING") return finalizeLock(again.id, deliveryDate, actor, send);
    return { deliveryDate: iso, status: again.status, alreadyLocked: isWeekLockedStatus(again.status), emailed: !!again.opsEmailSentAt };
  }
  return finalizeLock(week.id, deliveryDate, actor, send);
}

async function finalizeLock(weekId: string, deliveryDate: Date, actor: string, send: boolean): Promise<LockResult> {
  const iso = toISODate(deliveryDate);
  try {
    const lockedAt = new Date();
    const snapshot = await buildSnapshot(deliveryDate, actor, lockedAt);
    const claimed = await prisma.deliveryWeek.updateMany({
      where: { id: weekId, status: "LOCKING" },
      data: {
        status: "LOCKED",
        lockedAt,
        lockedBy: actor,
        snapshotJson: JSON.stringify(snapshot),
        lastError: "",
      },
    });
    if (claimed.count !== 1) {
      const again = await prisma.deliveryWeek.findUniqueOrThrow({ where: { id: weekId } });
      let emailed = !!again.opsEmailSentAt;
      if (send && isWeekLockedStatus(again.status) && !again.opsEmailSentAt) {
        const existing = parseSnapshot(again.snapshotJson);
        if (existing) emailed = await sendAndMark(again.id, existing);
      }
      return { deliveryDate: iso, status: again.status, alreadyLocked: isWeekLockedStatus(again.status), emailed };
    }
    let emailed = false;
    if (send) emailed = await sendAndMark(weekId, snapshot);
    return { deliveryDate: iso, status: "LOCKED", alreadyLocked: false, emailed };
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
    // Bara OPEN-återställning om vi fortfarande är i LOCKING. En redan skriven
    // snapshot får inte raderas för att PDF/mejl föll.
    await prisma.deliveryWeek.updateMany({
      where: { id: weekId, status: "LOCKING" },
      data: { lastError: message, status: "OPEN", snapshotJson: "" },
    }).catch(() => {});
    const again = await prisma.deliveryWeek.findUnique({ where: { id: weekId } }).catch(() => null);
    if (again && isWeekLockedStatus(again.status)) {
      return { deliveryDate: iso, status: again.status, alreadyLocked: true, emailed: !!again.opsEmailSentAt, error: message };
    }
    return { deliveryDate: iso, status: "OPEN", alreadyLocked: false, emailed: false, error: message };
  }
}

async function sendAndMark(weekId: string, snapshot: DeliverySnapshot): Promise<boolean> {
  const week = await prisma.deliveryWeek.findUnique({ where: { id: weekId } });
  if (week?.opsEmailSentAt) return true;
  const ok = await sendLockEmail(snapshot);
  if (ok) {
    await prisma.deliveryWeek.updateMany({
      where: { id: weekId, opsEmailSentAt: null },
      data: { opsEmailSentAt: new Date(), lastError: "" },
    });
    return true;
  }
  const settings = await getOpsSettings();
  const noRecipient = resolveOpsRecipients(settings).length === 0;
  await prisma.deliveryWeek.update({
    where: { id: weekId },
    data: {
      lastError: noRecipient
        ? "Ingen driftmejl-adress – fyll i under Inställningar. Listan är låst."
        : "Driftmejlet kunde inte skickas – se e-postloggen",
      // Tom mottagarlista: markera som hanterad så cronen inte retrys:ar i evighet.
      ...(noRecipient ? { opsEmailSentAt: new Date() } : {}),
    },
  }).catch(() => {});
  return false;
}

/** Skicka driftmejlet igen (admin). Rör inte snapshoten. */
export async function resendLockEmail(deliveryDate: Date): Promise<boolean> {
  const week = await prisma.deliveryWeek.findUnique({ where: { deliveryDate } });
  if (!week) return false;
  const snapshot = parseSnapshot(week.snapshotJson);
  if (!snapshot) return false;
  const ok = await sendLockEmail(snapshot);
  if (ok) {
    await prisma.deliveryWeek.update({
      where: { id: week.id },
      data: { opsEmailSentAt: new Date(), lastError: "" },
    });
  }
  return ok;
}

/**
 * Cron: materialisera prenumerationer, lås alla leveransdagar vars cutoff passerat.
 * Idempotent.
 */
export async function lockDueDeliveryWeeks(now = new Date(), actor = "system"): Promise<{ generated: number; locks: LockResult[]; generateError?: string }> {
  let generateError: string | undefined;
  const gen = await generateDueSubscriptionOrders({ now, horizonDays: 4 }).catch((e) => {
    generateError = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
    console.error("[lager] prenumerationsgenerering före låsning misslyckades:", describeError(e));
    return { generated: [], skipped: [] };
  });

  const settings = await getOpsSettings();
  const today = todayInStockholm(now);
  const horizon = addDays(today, 14);
  const orders = await prisma.order.findMany({
    where: { status: { not: "CANCELLED" }, deliveryDate: { gte: today, lte: horizon } },
    select: { deliveryDate: true },
  });
  const dates = [...new Set(orders.map((o) => toISODate(o.deliveryDate)))].sort();

  // Även veckor som hänger i LOCKING eller saknar mejl.
  const hanging = await prisma.deliveryWeek.findMany({
    where: {
      OR: [
        { status: "LOCKING" },
        { status: "LOCKED", opsEmailSentAt: null },
      ],
    },
    select: { deliveryDate: true },
  });
  for (const h of hanging) {
    const iso = toISODate(h.deliveryDate);
    if (!dates.includes(iso)) dates.push(iso);
  }

  const locks: LockResult[] = [];
  for (const iso of dates) {
    const date = fromISODate(iso);
    const week = await prisma.deliveryWeek.findUnique({ where: { deliveryDate: date } });
    const due = isPastCutoff(date, settings, now) || week?.status === "LOCKING";
    if (!due && !(week && isWeekLockedStatus(week.status) && !week.opsEmailSentAt)) continue;
    locks.push(await lockDeliveryDate(date, actor));
  }
  return { generated: gen.generated.length, locks, generateError };
}

export function lateChangesOf(json: string) {
  return parseLateChanges(json);
}

export type { DeliverySnapshot };
