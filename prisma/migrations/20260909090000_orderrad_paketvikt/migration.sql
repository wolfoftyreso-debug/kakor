-- Snapshot av paketvikt på orderraden så plock/lager inte följer senare produktändringar.

ALTER TABLE "OrderItem" ADD COLUMN "packageWeightGrams" INTEGER NOT NULL DEFAULT 0;

-- Befintliga rader: kopiera aktuell produktvikt (bättre än noll för paket).
UPDATE "OrderItem"
SET "packageWeightGrams" = COALESCE(
  (SELECT "packageWeightGrams" FROM "Product" WHERE "Product"."id" = "OrderItem"."productId"),
  0
);
