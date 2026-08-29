// Testuppsättning: egen SQLite-databas som migreras och seedas från tom databas
// inför varje testkörning (acceptanskrav: allt ska fungera från clean DB).
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

export default function setup() {
  const dbPath = path.resolve(__dirname, "../prisma/test.db");
  if (existsSync(dbPath)) rmSync(dbPath);

  const env = {
    ...process.env,
    DATABASE_URL: "file:./test.db",
    ADMIN_EMAIL: "test-admin@example.com",
    ADMIN_PASSWORD: "testlosenord-123456",
    EMAIL_PROVIDER: "log",
  };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });

  process.env.DATABASE_URL = "file:./test.db";
  process.env.EMAIL_PROVIDER = "log";
}
