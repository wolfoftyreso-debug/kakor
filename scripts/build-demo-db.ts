// =====================================================================
// TESTDEPLOY-BOOTSTRAP (endast demo-testdeploy-grenen)
// Bygger en färdig + seedad SQLite-demodatabas (prisma/demo.db) under
// `npm run build:demo`. Databasen paketeras in i serverless-bundlen och
// kopieras till /tmp vid kallstart (se src/instrumentation.ts).
//
// Admin-lösenordet HÅRDKODAS INTE i repot — det genereras slumpmässigt
// vid varje build och skrivs till byggloggen. All data är flyktig demodata.
// Riktig produktion (main-grenen) använder Neon PostgreSQL.
// =====================================================================
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const dbFile = path.resolve(__dirname, "../prisma/demo.db");
if (existsSync(dbFile)) rmSync(dbFile);

const adminEmail = "demo-admin@sockerbagaren.se";
const adminPassword = `demo-${randomBytes(9).toString("base64url")}`;

const databaseUrl = `file:${dbFile}`;

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,
  EMAIL_PROVIDER: "log",
};

// Migrationsmapparna är Postgres-SQL — demo-schemat skapas direkt ur schema.prisma.
execSync("npx prisma db push --skip-generate", { env, stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

// Exempeldata via den RIKTIGA ordermotorn (samma kod som checkout) så att
// admin är förifylld vid test och fakturaflödet kan verifieras i drift.
process.env.DATABASE_URL = databaseUrl;
process.env.EMAIL_PROVIDER = "log";

async function seedDemoContent() {
  const { prisma } = await import("../src/lib/db");
  const { createOrder } = await import("../src/lib/orders/create-order");
  const { createSubscription } = await import("../src/lib/subscriptions/service");
  const { toISODate, upcomingDeliveryDates } = await import("../src/lib/dates");

  const products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });
  // Leveransdagar hämtas från områdets VERKLIGA konfiguration (seedad av
  // prisma/seed.ts) — aldrig hårdkodade veckodagar, annars spricker
  // demoseedet när verksamheten ändrar leveransdagarna.
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  const dates = upcomingDeliveryDates(
    { weekdays: JSON.parse(area.weekdaysJson) as number[], leadTimeDays: area.leadTimeDays },
    2
  ).map(toISODate);

  const base = {
    areaSlug: "tyreso",
    deliveryDate: dates[0],
    contactName: "Eva Exempel",
    email: "eva@demobolaget.example",
    phone: "070-000 00 00",
    deliveryAddress: "Exempelgatan 1",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "Reception, plan 2",
    reference: "Demo",
    billingAddress: "",
  };

  const orderA = await createOrder(
    {
      ...base,
      items: [
        { productId: products[0].id, weightKg: 2 },
        { productId: products[1].id, weightKg: 1 },
      ],
      companyName: "Demobolaget AB",
      orgNumber: "556000-0001",
      invoiceEmail: "faktura@demobolaget.example",
    },
    { skipEmails: true }
  );

  const orderB = await createOrder(
    {
      ...base,
      items: [{ productId: products[2].id, weightKg: 3 }],
      areaSlug: "nacka",
      deliveryDate: dates[1],
      companyName: "Exempelverkstaden AB",
      orgNumber: "556000-0002",
      deliveryCity: "Nacka",
      deliveryPostalCode: "131 30",
      invoiceEmail: "ekonomi@exempelverkstaden.example",
    },
    { skipEmails: true }
  );

  // Order A: markera betald + levererad så reskontra/leveransvy har innehåll.
  await prisma.order.update({
    where: { id: orderA.order.id },
    data: { status: "CONFIRMED", paymentStatus: "PAID", deliveryStatus: "DELIVERED", deliveredAt: new Date() },
  });
  await prisma.invoice.update({
    where: { id: orderA.invoice.id },
    data: { status: "PAID", paidAt: new Date() },
  });
  await prisma.orderEvent.createMany({
    data: [
      { orderId: orderA.order.id, type: "PAID", message: "Markerad som betald (demodata)", actor: "demo-seed" },
      { orderId: orderA.order.id, type: "DELIVERED", message: "Markerad som levererad (demodata)", actor: "demo-seed" },
    ],
  });

  await createSubscription({
    items: [
      { productId: products[0].id, weightKg: 1 },
      { productId: products[1].id, weightKg: 1 },
    ],
    frequency: "BIWEEKLY",
    areaSlug: "huddinge",
    firstDeliveryDate: dates[0],
    companyName: "Fikaklubben AB",
    orgNumber: "556000-0003",
    contactName: "Pelle Prenumerant",
    email: "pelle@fikaklubben.example",
    phone: "",
    deliveryAddress: "Prenumerationsvägen 3",
    deliveryPostalCode: "141 30",
    deliveryCity: "Huddinge",
    deliveryInstruction: "",
    invoiceEmail: "faktura@fikaklubben.example",
    reference: "",
  });

  await prisma.$disconnect();
  return { orderB };
}

seedDemoContent()
  .then(({ orderB }) => {
    console.log("");
    console.log("==============================================================");
    console.log(" DEMO-DATABAS KLAR (prisma/demo.db) — inkl. exempelordrar");
    console.log(` DEMO-ADMIN E-POST:    ${adminEmail}`);
    console.log(` DEMO-ADMIN LÖSENORD:  ${adminPassword}`);
    console.log(` VERIFIERINGS-PDF:     /faktura/${orderB.invoice.downloadToken}`);
    console.log(" (endast för denna testdeploy — databasen är flyktig)");
    console.log("==============================================================");
    console.log("");
  })
  .catch((e) => {
    console.error("Demoseed misslyckades:", e);
    process.exit(1);
  });
