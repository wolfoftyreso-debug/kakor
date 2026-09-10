// Byggkommando (Vercel + Grok-deploy). Migrationer körs FÖRE next build
// när DATABASE_URL finns, så kod och schema inte går live i otakt.
//
// DIRECT_DATABASE_URL (opoolad Neon) används för migrate. Saknas den
// (Grok injicerar bara DATABASE_URL) återanvänds DATABASE_URL.
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
  process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
  console.log("[build] DIRECT_DATABASE_URL saknades – DATABASE_URL används för migrationer.");
}

if (process.env.DATABASE_URL) {
  run("npx prisma migrate deploy");
} else {
  console.warn(
    "[build] DATABASE_URL saknas – bygger utan migrationer. Databasberoende sidor kraschar tills databasen är kopplad."
  );
}

run("npx prisma generate");

if (process.env.DATABASE_URL) {
  // Idempotent katalog (produkter, områden, omröstning). Demo-månaden seedas
  // bara mot SQLite. Misslyckad seed ska inte tysta lämna tomma tabeller.
  run("npx tsx prisma/seed.ts");
}

run("npx next build");
