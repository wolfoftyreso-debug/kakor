-- AlterTable
ALTER TABLE "DeliveryArea" ADD COLUMN     "blockedDatesJson" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "piecesPerKgApprox" INTEGER;
