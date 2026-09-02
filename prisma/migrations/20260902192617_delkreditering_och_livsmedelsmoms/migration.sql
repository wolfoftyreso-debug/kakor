-- DropIndex
DROP INDEX "CreditNote_invoiceId_key";

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "vatRateBp" SET DEFAULT 600;

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");
