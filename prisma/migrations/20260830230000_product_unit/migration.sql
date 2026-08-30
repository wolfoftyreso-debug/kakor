-- Försäljningsenhet per produkt: "kg" (lösvikt) eller "paket" (styckvara,
-- t.ex. prova-på-paketet). pricePerKgOre tolkas som á-pris per enhet;
-- beloppsmatematiken (antal × á-pris) är oförändrad.
ALTER TABLE "Product" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'kg';
ALTER TABLE "Product" ADD COLUMN "packageWeightGrams" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'kg';
