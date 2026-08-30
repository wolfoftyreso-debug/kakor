import { PrismaClient } from "@prisma/client";

// EN central databas-layer: ALLA databasoperationer går genom denna klient.
//
// Vercel serverless + Neon:
//  - DATABASE_URL ska vara Neons POOLADE anslutningssträng (-pooler-värd)
//    med ?pgbouncer=true — Prisma stänger då av prepared statements som
//    inte fungerar genom PgBouncers transaction mode. Poolen skyddar mot
//    connection exhaustion när många funktioner kör samtidigt.
//  - Klienten skapas LAZY vid första användningen — aldrig vid import.
//    `next build` samlar page-data genom att importera routes, och en
//    import-tids-konstruktion skulle göra builden databasberoende
//    (CI/Vercel bygger utan DATABASE_URL). Saknad konfiguration ger
//    istället ett tydligt fel vid första faktiska databasanropet.
//  - Instansen återanvänds per process (varm lambda återanvänder
//    anslutningen; nya instanser öppnar via poolern).
//  - Migrations går mot DIRECT_DATABASE_URL (se prisma/schema.prisma) och
//    körs ALDRIG från runtime — endast från deploy-steget/CLI.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // TESTDEPLOY (demo-testdeploy-grenen): på Vercel utan DATABASE_URL används
  // den inbyggda SQLite-demodatabasen som instrumentation kopierat till /tmp.
  const url =
    process.env.DATABASE_URL ??
    (process.env.VERCEL ? "file:/tmp/sockerbagaren-demo.db" : undefined);
  if (!url) {
    // Fail-fast med tydligt fel — utan hemligheter i meddelandet.
    throw new Error(
      "DATABASE_URL är inte satt. Sätt Neons poolade anslutningssträng i miljön (se .env.example och DEPLOYMENT.md)."
    );
  }
  return new PrismaClient({
    datasourceUrl: url,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  return (globalForPrisma.prisma ??= createClient());
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
