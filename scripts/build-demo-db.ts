// =====================================================================
// TESTDEPLOY-BOOTSTRAP (Vercel-demo)
// Bygger en färdigmigrerad + seedad SQLite-demodatabas (prisma/demo.db)
// under `npm run build:demo`. Databasen paketeras in i serverless-bundlen
// och kopieras till /tmp vid kallstart (se src/instrumentation.ts).
//
// Admin-lösenordet HÅRDKODAS INTE i repot — det genereras slumpmässigt
// vid varje build och skrivs till byggloggen så att den som deployar kan
// läsa det där. Hela databasen är flyktig demodata.
//
// Används INTE för riktig produktion (riktig drift = persistent disk eller
// hostad databas, se README).
// =====================================================================
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const dbFile = path.resolve(__dirname, "../prisma/demo.db");
if (existsSync(dbFile)) rmSync(dbFile);

const adminEmail = "demo-admin@sockerbagaren.se";
const adminPassword = `demo-${randomBytes(9).toString("base64url")}`;

const env = {
  ...process.env,
  DATABASE_URL: "file:./demo.db",
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,
  EMAIL_PROVIDER: "log",
};

execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

console.log("");
console.log("==============================================================");
console.log(" DEMO-DATABAS KLAR (prisma/demo.db)");
console.log(` DEMO-ADMIN E-POST:    ${adminEmail}`);
console.log(` DEMO-ADMIN LÖSENORD:  ${adminPassword}`);
console.log(" (endast för denna testdeploy — databasen är flyktig)");
console.log("==============================================================");
console.log("");
