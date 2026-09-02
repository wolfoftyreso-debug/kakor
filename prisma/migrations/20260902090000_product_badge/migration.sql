-- Kort etikett som visas på produktkortet, t.ex. "Bästsäljare".
-- Data, inte hårdkodad text: sätts av verksamheten i admin.
ALTER TABLE "Product" ADD COLUMN "badge" TEXT NOT NULL DEFAULT '';
