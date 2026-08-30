-- Idempotensnyckel för prenumerationsstart: dubbelklick/nätverksretry
-- får aldrig skapa två prenumerationer.
ALTER TABLE "Subscription" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Subscription_idempotencyKey_key" ON "Subscription"("idempotencyKey");
