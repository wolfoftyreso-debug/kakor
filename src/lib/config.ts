// Central konfiguration. Juridiska uppgifter som ännu inte verifierats av
// verksamheten ligger som tydligt markerade platshållare — de hittas inte på.

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
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
    "Klassiska småkakor bakade på riktiga råvaror — levererade direkt till företag i Tyresö, Nacka, Haninge och Huddinge. Betalning mot faktura.",
};

export const invoiceConfig = {
  companyName: env("INVOICE_COMPANY_NAME", "Landvex AB"),
  orgNumber: env("INVOICE_ORG_NUMBER", "559141-7042"),
  address: env("INVOICE_ADDRESS", "Antennvägen 2"),
  postalCode: env("INVOICE_POSTAL_CODE", "135 48"),
  city: env("INVOICE_CITY", "Tyresö"),
  email: env("INVOICE_EMAIL", "[EJ VERIFIERAT: faktura-e-post]"),
  phone: env("INVOICE_PHONE", "[EJ VERIFIERAT: telefonnummer]"),
  bankgiro: env("INVOICE_BANKGIRO", "[EJ VERIFIERAT: bankgironummer]"),
  vatNumber: env("INVOICE_VAT_NUMBER", "[EJ VERIFIERAT: momsreg.nr]"),
  fSkatt: env("INVOICE_F_SKATT", "[EJ VERIFIERAT: F-skatt]"),
  paymentTermsDays: parseInt(env("INVOICE_PAYMENT_TERMS_DAYS", "30"), 10),
};

/** Platshållare ("[EJ VERIFIERAT: …]") får aldrig visas publikt på sajten. */
export function isVerifiedValue(value: string): boolean {
  return value !== "" && !value.startsWith("[EJ VERIFIERAT");
}

export const emailConfig = {
  provider: env("EMAIL_PROVIDER", "log"),
  resendApiKey: env("RESEND_API_KEY", ""),
  from: env("EMAIL_FROM", "Sockerbagaren <order@sockerbagaren.se>"),
  // Svarsadress för "svara på det här mejlet" — måste vara en bevakad låda.
  replyTo: env("EMAIL_REPLY_TO", ""),
  // Intern avisering vid ny order (tom = ingen).
  adminNotify: env("ADMIN_NOTIFY_EMAIL", ""),
};
