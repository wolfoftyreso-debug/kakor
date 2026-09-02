// Byggkommando på Vercel. I produktion körs databasmigrationerna FÖRE bygget
// så att kod och schema aldrig går live i otakt (en ny kolumn som deployas
// utan migration ger 500 på varje sida eftersom sajten renderas per request).
// Preview-deployer migrerar inte — de får aldrig peka på produktionsdatabasen.
//
// Tre fall i Production:
//   DATABASE_URL + DIRECT_DATABASE_URL  → migrera, sedan bygg
//   DATABASE_URL utan DIRECT_DATABASE_URL → avbryt (riktig databas men
//                                           migrationer kan inte köras)
//   ingen DATABASE_URL alls               → varna och bygg utan migrationer
//                                           (projektet är inte kopplat till
//                                           någon databas ännu; env-kontrollen
//                                           i runtime flaggar detta)
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

const isProduction = process.env.VERCEL_ENV === "production";
if (isProduction) {
  if (process.env.DIRECT_DATABASE_URL) {
    run("npx prisma migrate deploy");
  } else if (process.env.DATABASE_URL) {
    console.error(
      "[build] DATABASE_URL finns men DIRECT_DATABASE_URL saknas i Production — migrationer kan inte köras. Avbryter."
    );
    process.exit(1);
  } else {
    console.warn(
      "[build] VARNING: ingen DATABASE_URL i Production — bygger utan migrationer. Sajten saknar databas tills Neon kopplas (se DEPLOYMENT.md)."
    );
  }
} else {
  console.log(`[build] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(lokalt)"} — inga migrationer körs.`);
}
run("npx prisma generate");
run("npx next build");
