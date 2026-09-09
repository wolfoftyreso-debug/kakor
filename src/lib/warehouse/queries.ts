import { prisma } from "@/lib/db";
import {
  addDays,
  formatDeadline,
  formatIsoWeekLabel,
  isoWeekParam,
  isoWeekParts,
  mondayOfIsoWeek,
  toISODate,
  todayInStockholm,
} from "@/lib/dates";
import { isWeekLockedStatus } from "@/lib/status";
import { cutoffForDelivery } from "./cutoff";
import { getOpsSettings } from "./settings";
import { formatStockQty, gramsForLine, loadStock, productionNeedGrams } from "./inventory";
import { loadLiveOrders, parseLateChanges, parseSnapshot, snapshotOrderIds, ensureDeliveryWeek } from "./snapshot";
import type { DeliverySnapshot, LateChange, SnapshotStop, OpsSettings } from "./types";

export interface ProductNeed {
  productId: string | null;
  name: string;
  unit: string;
  packageWeightGrams: number;
  orderedGrams: number;
  orderedQty: number;
  physicalGrams: number;
  needGrams: number;
}

export interface DayOps {
  iso: string;
  deliveryDate: Date;
  isoYear: number;
  isoWeek: number;
  weekLabel: string;
  weekParam: string;
  status: string;
  lockedAt: Date | null;
  lockedBy: string;
  lastError: string;
  opsEmailSentAt: Date | null;
  snapshot: DeliverySnapshot | null;
  lateChanges: LateChange[];
  liveStops: SnapshotStop[];
  postCutoffStops: SnapshotStop[];
  byProduct: ProductNeed[];
  orderCount: number;
  totalGrams: number;
  subscriptionCount: number;
}

function productNeedsFromStops(
  stops: { items: { productId: string | null; productName: string; qty: number; unit: string; grams: number }[] }[],
  physical: Map<string, { grams: number; unit: string; packageWeightGrams: number }>
): ProductNeed[] {
  const map = new Map<string, ProductNeed>();
  for (const s of stops) {
    for (const i of s.items) {
      const key = `${i.productId ?? i.productName}|${i.unit}`;
      const phys = i.productId ? physical.get(i.productId) : undefined;
      const cur = map.get(key) ?? {
        productId: i.productId,
        name: i.productName,
        unit: i.unit,
        packageWeightGrams: phys?.packageWeightGrams ?? 0,
        orderedGrams: 0,
        orderedQty: 0,
        physicalGrams: phys?.grams ?? 0,
        needGrams: 0,
      };
      cur.orderedGrams += i.grams;
      cur.orderedQty += i.qty;
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .map((p) => ({ ...p, needGrams: productionNeedGrams(p.orderedGrams, p.physicalGrams) }))
    .sort((a, b) => b.orderedGrams - a.orderedGrams);
}

function liveToStops(orders: Awaited<ReturnType<typeof loadLiveOrders>>): SnapshotStop[] {
  return orders.map((o) => {
    const items = o.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      qty: i.weightKg,
      unit: i.unit,
      grams: gramsForLine(i),
    }));
    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      companyName: o.companyName,
      orgNumber: o.orgNumber,
      contactName: o.contactName,
      email: o.email,
      phone: o.phone,
      deliveryAddress: o.deliveryAddress,
      deliveryPostalCode: o.deliveryPostalCode,
      deliveryCity: o.deliveryCity,
      deliveryInstruction: o.deliveryInstruction,
      reference: o.reference,
      subscriptionNumber: o.subscription?.number ?? null,
      invoiceStatus: o.invoice?.status ?? null,
      invoiceNumber: o.invoice?.invoiceNumber ?? null,
      items,
      totalGrams: items.reduce((s, i) => s + i.grams, 0),
    };
  });
}

export async function loadDayOps(deliveryDate: Date): Promise<DayOps> {
  const { year, week } = isoWeekParts(deliveryDate);
  const iso = toISODate(deliveryDate);
  const [weekRow, live] = await Promise.all([
    prisma.deliveryWeek.findUnique({ where: { deliveryDate } }),
    loadLiveOrders(deliveryDate),
  ]);
  const locked = isWeekLockedStatus(weekRow?.status ?? "");
  const snapshot = weekRow && locked ? parseSnapshot(weekRow.snapshotJson) : null;
  const liveStops = liveToStops(live);
  const snapIds = snapshot ? snapshotOrderIds(snapshot) : new Set<string>();
  const postCutoffStops = snapshot ? liveStops.filter((s) => !snapIds.has(s.orderId)) : [];
  const displayStops = snapshot ? snapshot.stops : liveStops;

  const productIds = [...new Set(displayStops.flatMap((s) => s.items.map((i) => i.productId).filter((id): id is string => !!id)))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { inventory: true },
      })
    : [];
  const physical = new Map(
    products.map((p) => [
      p.id,
      { grams: p.inventory?.physicalGrams ?? 0, unit: p.unit, packageWeightGrams: p.packageWeightGrams },
    ])
  );
  const byProduct = snapshot
    ? snapshot.byProduct.map((p) => ({
        productId: p.productId,
        name: p.name,
        unit: p.unit,
        packageWeightGrams: p.productId ? (physical.get(p.productId)?.packageWeightGrams ?? 0) : 0,
        orderedGrams: p.grams,
        orderedQty: p.qty,
        physicalGrams: p.physicalGrams,
        needGrams: p.productionNeedGrams,
      }))
    : productNeedsFromStops(displayStops, physical);

  return {
    iso,
    deliveryDate,
    isoYear: year,
    isoWeek: week,
    weekLabel: formatIsoWeekLabel(year, week),
    weekParam: isoWeekParam(year, week),
    status: weekRow?.status ?? "OPEN",
    lockedAt: weekRow?.lockedAt ?? null,
    lockedBy: weekRow?.lockedBy ?? "",
    lastError: weekRow?.lastError ?? "",
    opsEmailSentAt: weekRow?.opsEmailSentAt ?? null,
    snapshot,
    lateChanges: weekRow ? parseLateChanges(weekRow.lateChangesJson) : [],
    liveStops,
    postCutoffStops,
    byProduct,
    orderCount: displayStops.length,
    totalGrams: displayStops.reduce((s, o) => s + o.totalGrams, 0),
    subscriptionCount: displayStops.filter((s) => s.subscriptionNumber).length,
  };
}

export async function loadWeekOps(year: number, week: number): Promise<DayOps[]> {
  const monday = mondayOfIsoWeek(year, week);
  const sunday = addDays(monday, 6);
  const weeks = await prisma.deliveryWeek.findMany({
    where: { isoYear: year, isoWeek: week },
    orderBy: { deliveryDate: "asc" },
  });
  const weekDates = new Set(weeks.map((w) => toISODate(w.deliveryDate)));
  const live = await prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      deliveryDate: { gte: monday, lte: sunday },
    },
    select: { deliveryDate: true },
  });
  const dates = new Set(weekDates);
  for (const o of live) dates.add(toISODate(o.deliveryDate));
  const sorted = [...dates].sort();
  const days: DayOps[] = [];
  for (const iso of sorted) {
    const d = new Date(`${iso}T00:00:00.000Z`);
    await ensureDeliveryWeek(d);
    days.push(await loadDayOps(d));
  }
  return days;
}

export async function listUpcomingDayOps(now = new Date()): Promise<DayOps[]> {
  const today = todayInStockholm(now);
  const orders = await prisma.order.findMany({
    where: { status: { not: "CANCELLED" }, deliveryDate: { gte: today, lte: addDays(today, 28) } },
    select: { deliveryDate: true },
  });
  const dates = [...new Set(orders.map((o) => toISODate(o.deliveryDate)))].sort();
  const days: DayOps[] = [];
  for (const iso of dates) {
    days.push(await loadDayOps(new Date(`${iso}T00:00:00.000Z`)));
  }
  return days;
}

export async function listHistoricWeeks() {
  const rows = await prisma.deliveryWeek.findMany({
    where: { status: { not: "OPEN" } },
    orderBy: { deliveryDate: "desc" },
    take: 52,
  });
  return rows.map((w) => {
    const snap = parseSnapshot(w.snapshotJson);
    return {
      id: w.id,
      iso: toISODate(w.deliveryDate),
      deliveryDate: w.deliveryDate,
      isoYear: w.isoYear,
      isoWeek: w.isoWeek,
      weekLabel: formatIsoWeekLabel(w.isoYear, w.isoWeek),
      weekParam: isoWeekParam(w.isoYear, w.isoWeek),
      status: w.status,
      lockedAt: w.lockedAt,
      orderCount: snap?.orderCount ?? 0,
      totalGrams: snap?.totalGrams ?? 0,
    };
  });
}

export interface OpsDashboard {
  settings: OpsSettings;
  nextDay: DayOps | null;
  cutoffLabel: string | null;
  stock: Awaited<ReturnType<typeof loadStock>>;
  needs: ProductNeed[];
}

export async function loadOpsDashboard(now = new Date()): Promise<OpsDashboard> {
  const [settings, upcoming, stock] = await Promise.all([getOpsSettings(), listUpcomingDayOps(now), loadStock()]);
  const nextDay = upcoming[0] ?? null;
  const cutoffLabel = nextDay
    ? formatDeadline(cutoffForDelivery(nextDay.deliveryDate, settings))
    : null;
  return { settings, nextDay, cutoffLabel, stock, needs: nextDay?.byProduct ?? [] };
}

export { formatStockQty, isWeekLockedStatus };
