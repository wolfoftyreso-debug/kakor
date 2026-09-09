// Central konfiguration. Juridiska uppgifter som ännu inte verifierats av
// verksamheten ligger som tydligt markerade platshållare – de hittas inte på.

function env(name: string, fallback: string): string {
  const v = process.env[name];
  if (v === undefined || v === "" || v.startsWith("[EJ VERIFIERAT")) return fallback;
  return v;
}

// Publik bas-URL: SITE_URL styr alltid; på Vercel utan SITE_URL (testdeploy)
// härleds den från produktions-URL:en (stabil mellan deployer) och i sista
// hand från deployment-URL:en, så att sitemap/canonical inte pekar på en
// engångs-deploy-URL.
function resolveSiteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const siteConfig = {
  name: "Sockerbagaren",
  url: resolveSiteUrl(),
  description:
    "Klassiska småkakor bakade på riktiga råvaror – levererade direkt till företag i Tyresö, Nacka, Haninge och Huddinge. Betalning mot faktura.",
};

// Avbokning/ändring: senast kl. HH, N arbetsdagar före leveransdagen.
// Räknas per order (helger och helgdagar hoppas över) och visas i kassan,
// orderbekräftelsen, villkoren och admin.
export const orderPolicy = {
  changeCutoffWorkdays: parseInt(env("ORDER_CHANGE_CUTOFF_WORKDAYS", "2"), 10),
  changeCutoffHour: parseInt(env("ORDER_CHANGE_CUTOFF_HOUR", "12"), 10),
};

export const invoiceConfig = {
  companyName: env("INVOICE_COMPANY_NAME", "Landvex AB"),
  orgNumber: env("INVOICE_ORG_NUMBER", "559141-7042"),
  address: env("INVOICE_ADDRESS", "Antennvägen 2"),
  postalCode: env("INVOICE_POSTAL_CODE", "135 48"),
  city: env("INVOICE_CITY", "Tyresö"),
  email: env("INVOICE_EMAIL", "info@sockerbagaren.se"),
  phone: env("INVOICE_PHONE", "[EJ VERIFIERAT: telefonnummer]"),
  // Inget bankgiro – Landvex tar emot betalning till Revolut (LT-IBAN).
  bankgiro: env("INVOICE_BANKGIRO", ""),
  iban: env("INVOICE_IBAN", "LT71 3250 0093 1434 0371"),
  bic: env("INVOICE_BIC", "REVOLT21"),
  intermediaryBic: env("INVOICE_INTERMEDIARY_BIC", "BARCGB22"),
  // Momsreg.nr = SE + org.nr utan bindestreck + 01. Landvex AB är
  // momsregistrerat (Bolagsverket/allabolag). F-skatt: godkänd.
  vatNumber: env("INVOICE_VAT_NUMBER", "SE559141704201"),
  fSkatt: env("INVOICE_F_SKATT", "Godkänd för F-skatt"),
  paymentTermsDays: parseInt(env("INVOICE_PAYMENT_TERMS_DAYS", "30"), 10),
};

/** Platshållare ("[EJ VERIFIERAT: …]") får aldrig visas publikt på sajten. */
export function isVerifiedValue(value: string): boolean {
  return value !== "" && !value.startsWith("[EJ VERIFIERAT");
}

/** Fakturan kan bära bankgiro och/eller IBAN – minst ett krävs för att sälja. */
export function hasPaymentDetails(): boolean {
  return isVerifiedValue(invoiceConfig.bankgiro) || isVerifiedValue(invoiceConfig.iban);
}

export const emailConfig = {
  provider: env("EMAIL_PROVIDER", "log"),
  resendApiKey: env("RESEND_API_KEY", ""),
  from: env("EMAIL_FROM", "Sockerbagaren <order@sockerbagaren.se>"),
  // Bevakad låda – kunder uppmanas "svara på det här mejlet". Inte no-reply.
  replyTo: env("EMAIL_REPLY_TO", "info@sockerbagaren.se"),
  // Intern avisering vid ny order.
  adminNotify: env("ADMIN_NOTIFY_EMAIL", "info@sockerbagaren.se"),
};
