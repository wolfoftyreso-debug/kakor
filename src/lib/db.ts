import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Databas-URL: DATABASE_URL styr alltid. På Vercel utan DATABASE_URL
// (testdeploy) används demodatabasen i /tmp — se src/instrumentation.ts.
function resolveDatasourceUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) return "file:/tmp/sockerbagaren-demo.db";
  return undefined; // lokal körning kräver DATABASE_URL i .env
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
