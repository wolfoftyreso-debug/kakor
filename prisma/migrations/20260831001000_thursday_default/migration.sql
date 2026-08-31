-- Leveransdag: endast torsdag just nu (verksamhetens uppgift, aug 2026).
-- Ändrar kolumnens DEFAULT för nya områden och uppdaterar de seedade
-- områdena som fortfarande står kvar på det gamla startvärdet tis+tors.
-- Områden som redan ändrats manuellt i admin rörs inte.
ALTER TABLE "DeliveryArea" ALTER COLUMN "weekdaysJson" SET DEFAULT '[4]';
UPDATE "DeliveryArea" SET "weekdaysJson" = '[4]' WHERE "weekdaysJson" = '[2,4]';
