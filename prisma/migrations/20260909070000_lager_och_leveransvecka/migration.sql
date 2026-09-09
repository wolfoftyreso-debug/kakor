-- Lager, lagerhistorik, leveransvecka och plockstatus.
-- SQLite-kompatibel SQL (demo) och Postgres (produktion): inga enum-typer,
-- JSON som TEXT, DateTime som TIMESTAMP(3).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickStatus" TEXT NOT NULL DEFAULT 'UNPICKED';

-- CreateIndex
CREATE INDEX "Order_pickStatus_idx" ON "Order"("pickStatus");

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "physicalGrams" INTEGER NOT NULL DEFAULT 0,
    "minGrams" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "gramsDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "orderId" TEXT,
    "beforeGrams" INTEGER NOT NULL,
    "afterGrams" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryOpsSettings" (
    "id" TEXT NOT NULL,
    "cutoffWeekday" INTEGER NOT NULL DEFAULT 3,
    "cutoffHour" INTEGER NOT NULL DEFAULT 12,
    "opsEmail" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOpsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryWeek" (
    "id" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "isoYear" INTEGER NOT NULL,
    "isoWeek" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT NOT NULL DEFAULT '',
    "snapshotJson" TEXT NOT NULL DEFAULT '',
    "opsEmailSentAt" TIMESTAMP(3),
    "lateChangesJson" TEXT NOT NULL DEFAULT '[]',
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryId_createdAt_idx" ON "InventoryMovement"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- CreateIndex
CREATE INDEX "InventoryMovement_kind_idx" ON "InventoryMovement"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryWeek_deliveryDate_key" ON "DeliveryWeek"("deliveryDate");

-- CreateIndex
CREATE INDEX "DeliveryWeek_isoYear_isoWeek_idx" ON "DeliveryWeek"("isoYear", "isoWeek");

-- CreateIndex
CREATE INDEX "DeliveryWeek_status_idx" ON "DeliveryWeek"("status");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
