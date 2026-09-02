// Central environment-validering. Körs vid serverstart (instrumentation)
// så att felkonfiguration upptäcks direkt istället för mitt i en checkout.
// Skriver ALDRIG hemligheters värden — bara variabelnamn.

export interface EnvReport {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function checkEnv(): EnvReport {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");

  const isVercelProd = process.env.VERCEL_ENV === "production";
  if (isVercelProd) {
    if (!process.env.SITE_URL) {
      warnings.push("SITE_URL saknas — deployment-URL används i länkar/canonical.");
    }
    if ((process.env.EMAIL_PROVIDER ?? "log") === "log") {
      warnings.push("EMAIL_PROVIDER=log i produktion — inga riktiga mejl skickas.");
    }
    if (!process.env.CRON_SECRET) {
      warnings.push("CRON_SECRET saknas — prenumerations-cron är avstängd.");
    }
    for (const name of ["INVOICE_BANKGIRO", "INVOICE_EMAIL", "INVOICE_VAT_NUMBER"]) {
      const v = process.env[name] ?? "";
      if (!v || v.includes("EJ VERIFIERAT")) {
        // Blockerande i produktion: fakturor utan bankgiro/momsnr/faktura-e-post
        // är inte giltiga kunddokument.
        missing.push(`${name} (inte satt/verifierad — fakturor saknar uppgiften)`);
      }
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}
