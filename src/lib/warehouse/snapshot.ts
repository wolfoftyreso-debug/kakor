import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isoWeekParts, toISODate } from "@/lib/dates";
import { isWeekLockedStatus } from "@/lib/status";
import { gramsForLine, productionNeedGrams } from "./inventory";
import type { DeliverySnapshot, LateChange, SnapshotStop } from "./types";

const orderInclude = {
  items: { include: { product: { select: { packageWeightGrams: true } } } },
  invoice: { select: { status: true, invoiceNumber: true } },
  subscription: { select: { number: true } },
} as const;

export async function loadLiveOrders(deliveryDate: Date) {
  return prisma.order.findMany({
    where: { deliveryDate, status: { not: "CANCELLED" } },
    include: orderInclude,
    orderBy: [{ deliveryPostalCode: "asc" }, { companyName: "asc" }, { orderNumber: "asc" }],
  });
}

function stopFromOrder(o: Awaited<ReturnType<typeof loadLiveOrders>>[number]): SnapshotStop {
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
}

export async function buildSnapshot(deliveryDate: Date, actor: string, lockedAt = new Date()): Promise<DeliverySnapshot> {
  const orders = await loadLiveOrders(deliveryDate);
  const { year, week } = isoWeekParts(deliveryDate);
  const stops = orders.map(stopFromOrder);

  const byProductMap = new Map<string, { productId: string | null; name: string; unit: string; qty: number; grams: number }>();
  for (const s of stops) {
    for (const i of s.items) {
      const key = `${i.productId ?? i.productName}|${i.unit}`;
      const cur = byProductMap.get(key) ?? { productId: i.productId, name: i.productName, unit: i.unit, qty: 0, grams: 0 };
      cur.qty += i.qty;
      cur.grams += i.grams;
      byProductMap.set(key, cur);
    }
  }

  const productIds = [...new Set(stops.flatMap((s) => s.items.map((i) => i.productId).filter((id): id is string => !!id)))];
  const inventories = productIds.length
    ? await prisma.inventory.findMany({ where: { productId: { in: productIds } } })
    : [];
  const physical = new Map(inventories.map((i) => [i.productId, i.physicalGrams]));

  const byProduct = [...byProductMap.values()]
    .sort((a, b) => b.grams - a.grams)
    .map((p) => ({
      ...p,
      physicalGrams: p.productId ? (physical.get(p.productId) ?? 0) : 0,
      productionNeedGrams: p.productId ? productionNeedGrams(p.grams, physical.get(p.productId) ?? 0) : 0,
    }));

  return {
    version: 1,
    lockedAt: lockedAt.toISOString(),
    lockedBy: actor,
    deliveryDate: toISODate(deliveryDate),
    isoYear: year,
    isoWeek: week,
    orderCount: stops.length,
    totalGrams: stops.reduce((s, o) => s + o.totalGrams, 0),
    stops,
    byProduct,
  };
}

export function parseSnapshot(json: string): DeliverySnapshot | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as DeliverySnapshot;
    if (v && v.version === 1 && Array.isArray(v.stops)) return v;
  } catch {
    // ogiltig snapshot
  }
  return null;
}

export function parseLateChanges(json: string): LateChange[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function appendLateChange(existingJson: string, change: Omit<LateChange, "id" | "at"> & { at?: string }): string {
  const list = parseLateChanges(existingJson);
  list.push({
    id: randomBytes(8).toString("hex"),
    at: change.at ?? new Date().toISOString(),
    actor: change.actor,
    reason: change.reason,
    type: change.type,
    orderId: change.orderId,
    orderNumber: change.orderNumber,
    detail: change.detail,
  });
  return JSON.stringify(list);
}

export function snapshotOrderIds(snapshot: DeliverySnapshot): Set<string> {
  return new Set(snapshot.stops.map((s) => s.orderId));
}

export async function recordLateChange(
  deliveryDate: Date,
  change: { actor: string; reason: string; type: "ORDER_ADDED" | "ORDER_REMOVED" | "ORDER_CHANGED" | "NOTE"; orderId?: string; orderNumber?: string; detail: string }
) {
  const week = await prisma.deliveryWeek.findUnique({ where: { deliveryDate } });
  if (!week || !isWeekLockedStatus(week.status)) return;
  await prisma.deliveryWeek.update({
    where: { id: week.id },
    data: { lateChangesJson: appendLateChange(week.lateChangesJson, change) },
  });
}

export async function ensureDeliveryWeek(deliveryDate: Date) {
  const existing = await prisma.deliveryWeek.findUnique({ where: { deliveryDate } });
  if (existing) return existing;
  const { year, week } = isoWeekParts(deliveryDate);
  try {
    return await prisma.deliveryWeek.create({
      data: { deliveryDate, isoYear: year, isoWeek: week, status: "OPEN" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await prisma.deliveryWeek.findUnique({ where: { deliveryDate } });
      if (raced) return raced;
    }
    throw e;
  }
}


