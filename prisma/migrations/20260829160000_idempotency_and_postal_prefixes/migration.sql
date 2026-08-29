-- AlterTable
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeliveryArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekdaysJson" TEXT NOT NULL DEFAULT '[2,4]',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 2,
    "postalCodePrefixesJson" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_DeliveryArea" ("active", "id", "leadTimeDays", "name", "slug", "sortOrder", "weekdaysJson") SELECT "active", "id", "leadTimeDays", "name", "slug", "sortOrder", "weekdaysJson" FROM "DeliveryArea";
DROP TABLE "DeliveryArea";
ALTER TABLE "new_DeliveryArea" RENAME TO "DeliveryArea";
CREATE UNIQUE INDEX "DeliveryArea_slug_key" ON "DeliveryArea"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

