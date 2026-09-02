// Körs en gång per serverstart (Next.js instrumentation, Node-runtime).
// 1) Sentry-felövervakning (endast fel — ingen tracing, ingen PII).
// 2) Fail-fast-miljövalidering: saknad kritisk konfiguration ska synas
//    direkt i loggarna vid boot — inte som slumpmässiga krascher i checkout.
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED } from "@/lib/sentry-config";

// Fångar serverfel från App Router (server components, route handlers).
export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // TESTDEPLOY (demo-testdeploy-grenen): utan DATABASE_URL på Vercel kopieras
  // den byggda demodatabasen till /tmp så serverless-funktionerna kan skriva.
  // /tmp är per instans och nollställs vid kallstart — flyktig demodata.
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    // webpackIgnore: middlewaren gör att Next även kompilerar instrumentation
    // för edge-runtime, där "node:"-moduler inte kan bundlas. Importen körs
    // ändå bara i Node (guarden ovan) — låt runtime lösa den.
    const fs = await import(/* webpackIgnore: true */ "node:fs");
    const path = await import(/* webpackIgnore: true */ "node:path");
    const target = "/tmp/sockerbagaren-demo.db";
    if (!fs.existsSync(target)) {
      const source = path.join(process.cwd(), "prisma", "demo.db");
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
        console.log("[demo] demodatabas kopierad till /tmp (flyktig testdata)");
      } else {
        console.error("[demo] prisma/demo.db saknas i bundlen — kör build:demo");
      }
    }
  }

  if (SENTRY_ENABLED) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0, // endast fel, ingen performance-tracing
      sendDefaultPii: false,
    });
  }

  const { checkEnv } = await import("@/lib/env-check");
  const report = checkEnv();

  for (const name of report.missing) {
    console.error(`[env] KRITISKT: ${name} saknas — databasberoende sidor kommer att fela.`);
  }
  for (const warning of report.warnings) {
    console.warn(`[env] ${warning}`);
  }
  if (report.ok && report.warnings.length === 0) {
    console.log("[env] miljökonfiguration OK");
  }
}
