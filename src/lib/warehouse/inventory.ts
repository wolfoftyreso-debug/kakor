import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lineWeightGrams, formatWeightKg, qtyLabel } from "@/lib/units";
import { orderReservesStock, type MovementKind } from "@/lib/status";
import { remainingByLine } from "@/lib/invoice/credit";
import { toISODate, todayInStockholm } from "@/lib/dates";

type Tx = Prisma.TransactionClient;

export interface StockLine {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  packageWeightGrams: number;
  physicalGrams: number;
  reservedGrams: number;
  reservedNextGrams: number;
  reservedLaterGrams: number;
  nextDeliveryIso: string | null;
  availableGrams: number;
  availableNextGrams: number;
  minGrams: number;
  active: boolean;
  lastAdjustment: {
    at: Date;
    actor: string;
    reason: string;
    gramsDelta: number;
    kind: string;
  } | null;
}

export function gramsForLine(item: {
  weightKg: number;
  unit: string;
  packageWeightGrams?: number | null;
  product?: { packageWeightGrams: number } | null;
}): number {
  const pkg =
    item.packageWeightGrams != null && item.packageWeightGrams > 0
      ? item.packageWeightGrams
      : (item.product?.packageWeightGrams ?? 0);
  return lineWeightGrams(item.weightKg, item.unit, pkg);
}

export function productionNeedGrams(orderedGrams: number, physicalGrams: number): number {
  return Math.max(0, orderedGrams - physicalGrams);
}

/** Visning: kilo som "12 kg", paket som "3 paket" när det går jämnt ut. */
export function formatStockQty(grams: number, unit: string, packageWeightGrams: number): string {
  if (unit === "paket" && packageWeightGrams > 0 && grams % packageWeightGrams === 0) {
    return qtyLabel(grams / packageWeightGrams, "paket");
  }
  return formatWeightKg(grams);
}

export function formatSignedGrams(grams: number, unit: string, packageWeightGrams: number): string {
  const sign = grams > 0 ? "+" : grams < 0 ? "−" : "";
  return `${sign}${formatStockQty(Math.abs(grams), unit, packageWeightGrams)}`;
}

export async function ensureInventory(productId: string, client: Tx | typeof prisma = prisma) {
  const existing = await client.inventory.findUnique({ where: { productId } });
  if (existing) return existing;
  try {
    return await client.inventory.create({
      data: { productId, physicalGrams: 0, minGrams: 0 },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await client.inventory.findUnique({ where: { productId } });
      if (raced) return raced;
    }
    throw e;
  }
}

/** Senaste PICK utan senare UNPICK = kakorna är redan ur frysen. */
export function hasActivePick(movements: { kind: string; createdAt: Date }[]): boolean {
  let lastPick: Date | null = null;
  let lastUnpick: Date | null = null;
  for (const m of movements) {
    if (m.kind === "PICK" && (!lastPick || m.createdAt > lastPick)) lastPick = m.createdAt;
    if (m.kind === "UNPICK" && (!lastUnpick || m.createdAt > lastUnpick)) lastUnpick = m.createdAt;
  }
  if (!lastPick) return false;
  return !lastUnpick || lastUnpick <= lastPick;
}

export async function reservedBreakdown(client: Tx | typeof prisma = prisma): Promise<{
  total: Map<string, number>;
  next: Map<string, number>;
  later: Map<string, number>;
  nextIso: string | null;
}> {
  const orders = await client.order.findMany({
    where: { status: { not: "CANCELLED" }, deliveryStatus: "PENDING", pickStatus: { in: ["UNPICKED", "PROBLEM"] } },
    select: {
      status: true,
      deliveryStatus: true,
      pickStatus: true,
      deliveryDate: true,
      items: { select: { productId: true, weightKg: true, unit: true, packageWeightGrams: true, productName: true, product: { select: { packageWeightGrams: true } } } },
      invoice: { select: { snapshotJson: true, creditNotes: { select: { kind: true, snapshotJson: true } } } },
      inventoryMovements: { where: { kind: { in: ["PICK", "UNPICK"] } }, select: { kind: true, createdAt: true } },
    },
  });
  const todayIso = toISODate(todayInStockholm());
  const upcoming = [
    ...new Set(
      orders.filter((o) => orderReservesStock(o) && toISODate(o.deliveryDate) >= todayIso).map((o) => toISODate(o.deliveryDate))
    ),
  ].sort();
  const nextIso = upcoming[0] ?? null;

  const total = new Map<string, number>();
  const next = new Map<string, number>();
  const later = new Map<string, number>();
  const add = (map: Map<string, number>, id: string, grams: number) => map.set(id, (map.get(id) ?? 0) + grams);

  for (const o of orders) {
    if (!orderReservesStock(o)) continue;
    if (o.pickStatus === "PROBLEM" && hasActivePick(o.inventoryMovements)) continue;
    let remaining: { remaining: number }[] | null = null;
    try {
      remaining = o.invoice ? remainingByLine(o.invoice.snapshotJson, o.invoice.creditNotes) : null;
    } catch {
      remaining = null;
    }
    const iso = toISODate(o.deliveryDate);
    o.items.forEach((i, idx) => {
      if (!i.productId) return;
      const qty = remaining?.[idx] ? remaining[idx].remaining : i.weightKg;
      if (qty <= 0) return;
      const grams = gramsForLine({ ...i, weightKg: qty });
      add(total, i.productId, grams);
      if (nextIso && iso === nextIso) add(next, i.productId, grams);
      else if (nextIso && iso > nextIso) add(later, i.productId, grams);
      else add(next, i.productId, grams);
    });
  }
  return { total, next, later, nextIso };
}

/** Reserverat = gram på ej avbrutna, ej plockade, ej levererade ordrar.
 * Plockade ordrar har redan lämnat frysen (fysiskt saldo minskat).
 * PROBLEM efter plock reserverar inte igen – kakorna är redan dragna.
 */
export async function reservedGramsByProduct(client: Tx | typeof prisma = prisma): Promise<Map<string, number>> {
  return (await reservedBreakdown(client)).total;
}

export async function loadStock(): Promise<StockLine[]> {
  const products = await prisma.product.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: {
      inventory: true,
      inventoryMovements: {
        where: { kind: { in: ["INCOMING", "OUTGOING", "ADJUSTMENT"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const reserved = await reservedBreakdown();
  return products.map((p) => {
    const physical = p.inventory?.physicalGrams ?? 0;
    const reservedGrams = reserved.total.get(p.id) ?? 0;
    const reservedNextGrams = reserved.next.get(p.id) ?? 0;
    const reservedLaterGrams = reserved.later.get(p.id) ?? 0;
    const last = p.inventoryMovements[0] ?? null;
    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      unit: p.unit,
      packageWeightGrams: p.packageWeightGrams,
      physicalGrams: physical,
      reservedGrams,
      reservedNextGrams,
      reservedLaterGrams,
      nextDeliveryIso: reserved.nextIso,
      availableGrams: physical - reservedGrams,
      availableNextGrams: physical - reservedNextGrams,
      minGrams: p.inventory?.minGrams ?? 0,
      active: p.active,
      lastAdjustment: last
        ? { at: last.createdAt, actor: last.actor, reason: last.reason, gramsDelta: last.gramsDelta, kind: last.kind }
        : null,
    };
  });
}

export async function adjustInventory(input: {
  productId: string;
  gramsDelta: number;
  kind: MovementKind;
  reason: string;
  actor: string;
  orderId?: string;
}): Promise<{ beforeGrams: number; afterGrams: number }> {
  if (input.gramsDelta === 0) throw new Error("Ingen förändring");
  if (input.kind === "PICK" || input.kind === "UNPICK") {
    throw new Error("Plock registreras via plockstatus, inte som manuell justering");
  }
  return prisma.$transaction(async (tx) => {
    const inv = await ensureInventory(input.productId, tx);
    const before = inv.physicalGrams;
    const after = before + input.gramsDelta;
    await tx.inventory.update({ where: { id: inv.id }, data: { physicalGrams: after } });
    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        productId: input.productId,
        kind: input.kind,
        gramsDelta: input.gramsDelta,
        reason: input.reason,
        actor: input.actor,
        orderId: input.orderId,
        beforeGrams: before,
        afterGrams: after,
      },
    });
    return { beforeGrams: before, afterGrams: after };
  });
}

export async function setMinLevel(productId: string, minGrams: number) {
  const inv = await ensureInventory(productId);
  await prisma.inventory.update({ where: { id: inv.id }, data: { minGrams: Math.max(0, minGrams) } });
}

/** Minska fysiskt lager för en orders rader. Idempotent per övergång till PICKED. */
export async function applyOrderPick(orderId: string, actor: string, client?: Tx): Promise<void> {
  const run = async (tx: Tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { packageWeightGrams: true } } } },
        invoice: { include: { creditNotes: { select: { kind: true, snapshotJson: true } } } },
      },
    });
    if (!order || order.status === "CANCELLED") return;
    const already = await tx.inventoryMovement.findFirst({
      where: { orderId, kind: "PICK" },
      orderBy: { createdAt: "desc" },
    });
    const unpick = await tx.inventoryMovement.findFirst({
      where: { orderId, kind: "UNPICK" },
      orderBy: { createdAt: "desc" },
    });
    // Senaste PICK utan senare UNPICK = redan dragen.
    if (already && (!unpick || unpick.createdAt <= already.createdAt)) return;

    let remaining: { remaining: number }[] | null = null;
    try {
      remaining = order.invoice ? remainingByLine(order.invoice.snapshotJson, order.invoice.creditNotes) : null;
    } catch {
      remaining = null;
    }

    for (const [idx, item] of order.items.entries()) {
      if (!item.productId) continue;
      const qty = remaining?.[idx] ? remaining[idx].remaining : item.weightKg;
      if (qty <= 0) continue;
      const delta = -gramsForLine({ ...item, weightKg: qty });
      if (delta === 0) continue;
      const inv = await ensureInventory(item.productId, tx);
      const updated = await tx.inventory.update({
        where: { id: inv.id },
        data: { physicalGrams: { increment: delta } },
      });
      const after = updated.physicalGrams;
      const before = after - delta;
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          productId: item.productId,
          kind: "PICK",
          gramsDelta: delta,
          reason: `Plock ${order.orderNumber}`,
          actor,
          orderId,
          beforeGrams: before,
          afterGrams: after,
        },
      });
    }
  };
  if (client) return run(client);
  await prisma.$transaction(run);
}

/** Återställ fysiskt lager efter av-plock eller avbruten plockad order. */
export async function applyOrderUnpick(orderId: string, actor: string, client?: Tx): Promise<void> {
  const run = async (tx: Tx) => {
    const lastPick = await tx.inventoryMovement.findFirst({
      where: { orderId, kind: "PICK" },
      orderBy: { createdAt: "desc" },
    });
    if (!lastPick) return;
    const lastUnpick = await tx.inventoryMovement.findFirst({
      where: { orderId, kind: "UNPICK" },
      orderBy: { createdAt: "desc" },
    });
    if (lastUnpick && lastUnpick.createdAt >= lastPick.createdAt) return;

    // Återställ exakt det som drogs – inte omräknat från nuvarande rad/kredit/produktvikt.
    const picks = await tx.inventoryMovement.findMany({
      where: {
        orderId,
        kind: "PICK",
        ...(lastUnpick ? { createdAt: { gt: lastUnpick.createdAt } } : {}),
      },
    });
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
    for (const pick of picks) {
      const delta = -pick.gramsDelta;
      if (delta === 0 || !pick.productId) continue;
      const inv = await ensureInventory(pick.productId, tx);
      const updated = await tx.inventory.update({
        where: { id: inv.id },
        data: { physicalGrams: { increment: delta } },
      });
      const after = updated.physicalGrams;
      const before = after - delta;
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          productId: pick.productId,
          kind: "UNPICK",
          gramsDelta: delta,
          reason: `Avplock ${order?.orderNumber ?? orderId}`,
          actor,
          orderId,
          beforeGrams: before,
          afterGrams: after,
        },
      });
    }
  };
  if (client) return run(client);
  await prisma.$transaction(run);
}
