// Lokal utvecklingsdatabas: startar en inbäddad PostgreSQL (samma motor som
// Neon), migrerar och seedar — ingen Neon-anslutning krävs för utveckling.
//
//   npm run dev:db          (låt stå i en egen terminal)
//   DATABASE_URL=postgresql://postgres:postgres@localhost:55432/sockerbagaren
//
// Datat ligger kvar mellan körningar i /tmp/sockerbagaren-dev-pg
// (persistent: true). Ta bort katalogen för att börja om.
import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 55432;
const BASE_DIR = "/tmp/sockerbagaren-dev-pg";
const DB_URL = `postgresql://postgres:postgres@localhost:${PORT}/sockerbagaren`;

async function main() {
  const fresh = !existsSync(`${BASE_DIR}/data`);
  mkdirSync(BASE_DIR, { recursive: true });
  chmodSync(BASE_DIR, 0o777);

  const pg = new EmbeddedPostgres({
    databaseDir: `${BASE_DIR}/data`,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
  });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("sockerbagaren");

  const env = { ...process.env, DATABASE_URL: DB_URL, DIRECT_DATABASE_URL: DB_URL };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

  console.log("");
  console.log("Utvecklingsdatabas igång. Sätt i .env:");
  console.log(`  DATABASE_URL="${DB_URL}"`);
  console.log(`  DIRECT_DATABASE_URL="${DB_URL}"`);
  console.log("Avsluta med Ctrl+C.");

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
