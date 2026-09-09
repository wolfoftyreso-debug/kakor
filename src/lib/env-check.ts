import { invoiceConfig, emailConfig, isVerifiedValue, hasPaymentDetails } from "@/lib/config";

// Central environment-validering. Körs vid serverstart (instrumentation)
// så att felkonfiguration upptäcks direkt istället för mitt i en checkout.
// Skriver ALDRIG hemligheters värden – bara variabelnamn.

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
      warnings.push("SITE_URL saknas – deployment-URL används i länkar/canonical.");
    }
    if ((process.env.EMAIL_PROVIDER ?? "log") === "log") {
      warnings.push("EMAIL_PROVIDER=log i produktion – inga riktiga mejl skickas.");
    }
    if (process.env.EMAIL_PROVIDER === "resend" && !process.env.RESEND_API_KEY) {
      missing.push("RESEND_API_KEY (EMAIL_PROVIDER=resend utan nyckel – faller tyst till loggning)");
    }
    if (!emailConfig.replyTo) {
      // Hela supportvägen är "svara på mejlet" – utan bevakad svarsadress går svaren i tomma intet.
      missing.push("EMAIL_REPLY_TO (kunder uppmanas svara på mejlen – adressen måste vara en bevakad låda)");
    }
    if (!emailConfig.adminNotify) {
      warnings.push("ADMIN_NOTIFY_EMAIL saknas – ingen intern avisering vid nya ordrar.");
    }
    if (!process.env.CRON_SECRET) {
      warnings.push("CRON_SECRET saknas – prenumerations-cron är avstängd.");
    }
    const turnstileSite = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const turnstileSecret = !!process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSite !== turnstileSecret) {
      missing.push("Turnstile: bara en av NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY är satt – sätt båda eller ingen");
    } else if (!turnstileSite) {
      warnings.push("Turnstile saknas – kassan har inget robotskydd utöver rate limiting.");
    }
    if (!hasPaymentDetails()) {
      missing.push("INVOICE_IBAN eller INVOICE_BANKGIRO (fakturan saknar betalningsuppgifter)");
    }
    if (!isVerifiedValue(invoiceConfig.email)) {
      missing.push("INVOICE_EMAIL (inte satt/verifierad – fakturor saknar uppgiften)");
    }
    if (!isVerifiedValue(invoiceConfig.vatNumber)) {
      missing.push("INVOICE_VAT_NUMBER (inte satt/verifierad – fakturor saknar uppgiften)");
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}
