import { prisma } from "@/lib/db";
import { addDays, fromISODate, toISODate, todayInStockholm } from "@/lib/dates";
import { isWeekLockedStatus } from "@/lib/status";
import { cutoffClosedMessage, isPastCutoff } from "./cutoff";
import { getOpsSettings } from "./settings";

/**
 * Datum som kassan inte får erbjuda: redan låsta, under låsning, eller
 * cutoff passerad (även om cron inte hunnit skriva snapshoten).
 */
export async function getWarehouseClosedDates(now = new Date()): Promise<Set<string>> {
  const settings = await getOpsSettings();
  const closed = new Set<string>();
  const weeks = await prisma.deliveryWeek.findMany({
    where: { status: { not: "OPEN" } },
    select: { deliveryDate: true, status: true },
  });
  for (const w of weeks) {
    if (w.status === "LOCKING" || isWeekLockedStatus(w.status)) closed.add(toISODate(w.deliveryDate));
  }
  const today = todayInStockholm(now);
  const extraDates = new Set<string>();
  let cursor = today;
  for (let i = 0; i < 21; i++) {
    extraDates.add(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  for (const iso of extraDates) {
    if (isPastCutoff(fromISODate(iso), settings, now)) closed.add(iso);
  }
  return closed;
}

export async function isDeliveryDateClosed(date: Date, now = new Date()): Promise<boolean> {
  const closed = await getWarehouseClosedDates(now);
  return closed.has(toISODate(date));
}

export async function nextOpenDeliveryDate(
  candidates: Date[],
  now = new Date()
): Promise<Date | null> {
  const closed = await getWarehouseClosedDates(now);
  return candidates.find((d) => !closed.has(toISODate(d))) ?? null;
}

export { cutoffClosedMessage };
