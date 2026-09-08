-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "manageToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_manageToken_key" ON "Subscription"("manageToken");
