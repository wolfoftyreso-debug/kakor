// Byggkommando på Vercel. I produktion körs databasmigrationerna FÖRE bygget
// så att kod och schema aldrig går live i otakt (en ny kolumn som deployas
// utan migration ger 500 på varje sida eftersom sajten renderas per request).
// Preview-deployer migrerar inte — de får aldrig peka på produktionsdatabasen.
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

const isProduction = process.env.VERCEL_ENV === "production";
if (isProduction) {
  if (!process.env.DIRECT_DATABASE_URL) {
    console.error("[build] DIRECT_DATABASE_URL saknas i Production — migrationer kan inte köras. Avbryter.");
    process.exit(1);
  }
  run("npx prisma migrate deploy");
} else {
  console.log(`[build] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(lokalt)"} — inga migrationer körs.`);
}
run("npx prisma generate");
run("npx next build");
