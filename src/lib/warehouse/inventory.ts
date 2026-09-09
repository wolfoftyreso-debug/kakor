import { prisma } from "@/lib/db";
import { lineWeightGrams, formatWeightKg, qtyLabel } from "@/lib/units";
import { orderReservesStock, type MovementKind } from "@/lib/status";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface StockLine {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  packageWeightGrams: number;
  physicalGrams: number;
  reservedGrams: number;
  availableGrams: number;
  minGrams: number;
  lastAdjustment: {
    at: Date;
    actor: string;
    reason: string;
    gramsDelta: number;
    kind: string;
  } | null;
}

export function gramsForLine(item: { weightKg: number; unit: string; product?: { packageWeightGrams: number } | null }): number {
  return lineWeightGrams(item.weightKg, item.unit, item.product?.packageWeightGrams ?? 0);
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

export async function ensureInventory(productId: string, client: Tx | typeof prisma = prisma) {
  const existing = await client.inventory.findUnique({ where: { productId } });
  if (existing) return existing;
  return client.inventory.create({
    data: { productId, physicalGrams: 0, minGrams: 0 },
  });
}

/**
 * Reserverat = gram på ej avbrutna, ej plockade, ej levererade ordrar.
 * Plockade ordrar har redan lämnat frysen (fysiskt saldo minskat).
 */
export async function reservedGramsByProduct(client: Tx | typeof prisma = prisma): Promise<Map<string, number>> {
  const orders = await client.order.findMany({
    where: { status: { not: "CANCELLED" }, deliveryStatus: "PENDING", pickStatus: { in: ["UNPICKED", "PROBLEM"] } },
    select: {
      status: true,
      deliveryStatus: true,
      pickStatus: true,
      items: { select: { productId: true, weightKg: true, unit: true, product: { select: { packageWeightGrams: true } } } },
    },
  });
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!orderReservesStock(o)) continue;
    for (const i of o.items) {
      if (!i.productId) continue;
      map.set(i.productId, (map.get(i.productId) ?? 0) + gramsForLine(i));
    }
  }
  return map;
}

export async function loadStock(): Promise<StockLine[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      inventory: true,
      inventoryMovements: {
        where: { kind: { in: ["INCOMING", "OUTGOING", "ADJUSTMENT"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const reserved = await reservedGramsByProduct();
  return products.map((p) => {
    const physical = p.inventory?.physicalGrams ?? 0;
    const reservedGrams = reserved.get(p.id) ?? 0;
    const last = p.inventoryMovements[0] ?? null;
    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      unit: p.unit,
      packageWeightGrams: p.packageWeightGrams,
      physicalGrams: physical,
      reservedGrams,
      availableGrams: physical - reservedGrams,
      minGrams: p.inventory?.minGrams ?? 0,
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
      include: { items: { include: { product: { select: { packageWeightGrams: true } } } } },
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

    for (const item of order.items) {
      if (!item.productId) continue;
      const delta = -gramsForLine(item);
      if (delta === 0) continue;
      const inv = await ensureInventory(item.productId, tx);
      const before = inv.physicalGrams;
      const after = before + delta;
      await tx.inventory.update({ where: { id: inv.id }, data: { physicalGrams: after } });
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
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { packageWeightGrams: true } } } } },
    });
    if (!order) return;
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

    for (const item of order.items) {
      if (!item.productId) continue;
      const delta = gramsForLine(item);
      if (delta === 0) continue;
      const inv = await ensureInventory(item.productId, tx);
      const before = inv.physicalGrams;
      const after = before + delta;
      await tx.inventory.update({ where: { id: inv.id }, data: { physicalGrams: after } });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          productId: item.productId,
          kind: "UNPICK",
          gramsDelta: delta,
          reason: `Avplock ${order.orderNumber}`,
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
