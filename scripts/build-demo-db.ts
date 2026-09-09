// =====================================================================
// TESTDEPLOY-BOOTSTRAP (endast demo-testdeploy-grenen)
// Bygger en färdig + seedad SQLite-demodatabas (prisma/demo.db) under
// `npm run build:demo`. Databasen paketeras in i serverless-bundlen och
// kopieras till /tmp vid kallstart (se src/instrumentation.ts).
//
// Admin-lösenordet HÅRDKODAS INTE i repot — det genereras slumpmässigt
// vid varje build och skrivs till byggloggen. All data är flyktig demodata.
// Riktig produktion (main-grenen) använder Neon PostgreSQL.
//
// Innehållet kommer från prisma/seed.ts → seedMonth() (20 kunder, en
// månads drift). Vi lägger inte på extra ordrar här – cutoff skulle
// fälla bygget, och reskontran ska spegla månadssimuleringen.
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

process.env.DATABASE_URL = databaseUrl;
process.env.EMAIL_PROVIDER = "log";

async function report() {
  const { prisma } = await import("../src/lib/db");
  const sample = await prisma.invoice.findFirst({
    where: { status: "UNPAID", order: { status: { not: "CANCELLED" } } },
    orderBy: { dueDate: "asc" },
    select: { downloadToken: true, invoiceNumber: true },
  });
  const orders = await prisma.order.count();
  const unpaid = await prisma.invoice.count({ where: { status: "UNPAID" } });
  await prisma.$disconnect();
  return { sample, orders, unpaid };
}

report()
  .then(({ sample, orders, unpaid }) => {
    console.log("");
    console.log("==============================================================");
    console.log(" DEMO-DATABAS KLAR (prisma/demo.db) — månadssimulation");
    console.log(` DEMO-ADMIN E-POST:    ${adminEmail}`);
    console.log(` DEMO-ADMIN LÖSENORD:  ${adminPassword}`);
    console.log(` ORDRAR / OBETALDA:    ${orders} / ${unpaid}`);
    if (sample) {
      console.log(` VERIFIERINGS-PDF:     /faktura/${sample.downloadToken} (${sample.invoiceNumber})`);
    }
    console.log(" (endast för denna testdeploy — databasen är flyktig)");
    console.log("==============================================================");
    console.log("");
  })
  .catch((e) => {
    console.error("Demoseed misslyckades:", e);
    process.exit(1);
  });
