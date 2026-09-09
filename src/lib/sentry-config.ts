// Sentry-konfiguration – MEDVETET endast server-side (instrumentation.ts).
// Klient-SDK:n kostar ~80 kB First Load JS; för denna skala är serverfelen
// (checkout, PDF, cron, admin-actions) de kritiska att fånga. DSN är en
// publik identifierare (ingen hemlighet). SENTRY_DSN i miljön vinner;
// tom sträng stänger av Sentry helt.
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  process.env.SENTRY_DSN ??
  "https://60994f122f69152279ed2589642d7eb2@o4511987233652736.ingest.de.sentry.io/4511999930925136";

export const SENTRY_ENABLED =
  SENTRY_DSN !== "" &&
  // Bara Vercel production (riktiga kunder) – preview/demo ska inte skicka
  // orderdata till felövervakningen. SENTRY_FORCE tvingar på (t.ex. staging).
  (process.env.SENTRY_FORCE === "true" || process.env.VERCEL_ENV === "production");
