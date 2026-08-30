// Sentry-konfiguration — MEDVETET endast server-side (instrumentation.ts).
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
  // Endast i deployade miljöer — lokal utveckling och tester ska inte rapportera.
  // VERCEL finns server-side; NEXT_PUBLIC_VERCEL_ENV exponeras av Vercel i klienten.
  (!!process.env.VERCEL ||
    !!process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.SENTRY_FORCE === "true");
