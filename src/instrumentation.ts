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

  if (SENTRY_ENABLED) {
    Sentry.init({
      release: process.env.VERCEL_GIT_COMMIT_SHA,
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
