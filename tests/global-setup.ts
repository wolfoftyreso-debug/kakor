// Testuppsättning: startar en riktig inbäddad PostgreSQL (samma motor som
// Neon kör) och migrerar + seedar från tom databas inför varje testkörning.
// Acceptanskrav: allt ska fungera från clean database — precis som mot en
// nyskapad Neon-databas.
import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const PG_PORT = 55433;
const BASE_DIR = "/tmp/sockerbagaren-test-pg";
const DB_URL = `postgresql://postgres:postgres@localhost:${PG_PORT}/sockerbagaren_test`;

export default async function setup() {
  if (existsSync(BASE_DIR)) rmSync(BASE_DIR, { recursive: true, force: true });
  // embedded-postgres kör som OS-användaren "postgres" när processen är root
  // (Postgres vägrar köra som root) — katalogen måste vara åtkomlig.
  mkdirSync(BASE_DIR, { recursive: true });
  chmodSync(BASE_DIR, 0o777);

  const pg = new EmbeddedPostgres({
    databaseDir: `${BASE_DIR}/data`,
    user: "postgres",
    password: "postgres",
    port: PG_PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("sockerbagaren_test");

  const env = {
    ...process.env,
    DATABASE_URL: DB_URL,
    DIRECT_DATABASE_URL: DB_URL,
    ADMIN_EMAIL: "test-admin@example.com",
    ADMIN_PASSWORD: "testlosenord-123456",
    EMAIL_PROVIDER: "log",
  };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });

  // Workers ärver processens env.
  process.env.DATABASE_URL = DB_URL;
  process.env.DIRECT_DATABASE_URL = DB_URL;

  return async () => {
    await pg.stop();
    rmSync(BASE_DIR, { recursive: true, force: true });
  };
}
