import { PrismaClient } from "@prisma/client";

// EN central databas-layer: ALLA databasoperationer går genom denna klient.
//
// Vercel serverless + Neon:
//  - DATABASE_URL ska vara Neons POOLADE anslutningssträng (-pooler-värd)
//    med ?pgbouncer=true — Prisma stänger då av prepared statements som
//    inte fungerar genom PgBouncers transaction mode. Poolen skyddar mot
//    connection exhaustion när många funktioner kör samtidigt.
//  - Klienten återanvänds per instans via globalThis (varm lambda
//    återanvänder anslutningen; nya instanser öppnar via poolern).
//  - Migrations går mot DIRECT_DATABASE_URL (se prisma/schema.prisma) och
//    körs ALDRIG från runtime — endast från deploy-steget/CLI.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Fail-fast med tydligt fel — utan hemligheter i meddelandet.
    throw new Error(
      "DATABASE_URL är inte satt. Sätt Neons poolade anslutningssträng i miljön (se .env.example och DEPLOYMENT.md)."
    );
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: requireDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
