// SEO-status för admin. UNKNOWN när data saknas – aldrig låtsas att allt är OK.

import { siteConfig } from "@/lib/config";
import { CONTENT_DATES } from "@/lib/seo/content-dates";

export type SeoLevel = "GREEN" | "WARNING" | "CRITICAL" | "UNKNOWN";

export interface SeoCheck {
  id: string;
  label: string;
  level: SeoLevel;
  detail: string;
  action?: string;
}

export const LAST_SEO_AUDIT = "2026-09-10";

export interface SeoStatusInput {
  siteUrl: string;
  vercelEnv?: string;
  googleVerification?: string;
  bingVerification?: string;
  ga4?: string;
  sameAs?: string;
}

function productionHost(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "sockerbagaren.se";
  } catch {
    return false;
  }
}

export function readSeoStatusInput(): SeoStatusInput {
  return {
    siteUrl: siteConfig.url,
    vercelEnv: process.env.VERCEL_ENV,
    googleVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    bingVerification: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
    ga4: process.env.NEXT_PUBLIC_GA4_ID,
    sameAs: process.env.NEXT_PUBLIC_SAME_AS,
  };
}

export function computeSeoStatus(input: SeoStatusInput): SeoCheck[] {
  const onProdDomain = productionHost(input.siteUrl);
  const isVercelPreview = input.vercelEnv === "preview";
  const isVercelProd = input.vercelEnv === "production";
  const googleOk = Boolean(input.googleVerification?.trim());
  const bingOk = Boolean(input.bingVerification?.trim());
  const ga4Ok = Boolean(input.ga4?.trim() && /^G-[A-Z0-9]{6,14}$/.test(input.ga4.trim()));
  const sameAs = (input.sameAs ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^https?:\/\//.test(v));

  return [
    {
      id: "indexability",
      label: "Indexability",
      level: isVercelPreview ? "WARNING" : "GREEN",
      detail: isVercelPreview
        ? "Preview-deploy är noindex (avsiktligt, så den inte konkurrerar med produktion)."
        : isVercelProd
          ? "Produktion är indexerbar. Admin, API, faktura och prenumerationshantering är noindex/disallow."
          : "Publika sidor är indexerbara. Admin, API, faktura och prenumerationshantering är noindex/disallow.",
    },
    {
      id: "domain",
      label: "Produktionsdomän",
      level: onProdDomain ? "GREEN" : "WARNING",
      detail: onProdDomain
        ? "Canonical, sitemap och schema pekar på sockerbagaren.se."
        : `SITE_URL är ${input.siteUrl}. Canonical och sitemap pekar dit tills sockerbagaren.se kopplas.`,
      action: onProdDomain
        ? undefined
        : "Koppla sockerbagaren.se sist och sätt SITE_URL=https://sockerbagaren.se i produktion.",
    },
    {
      id: "robots",
      label: "Robots",
      level: "GREEN",
      detail: "robots.txt tillåter sök och AI-hämtning, spärrar /admin /api /faktura /prenumeration/hantera och pekar på sitemap.xml.",
    },
    {
      id: "sitemap",
      label: "Sitemap",
      level: "GREEN",
      detail: "Dynamisk sitemap med kanoniska publika URL:er och aktiva produkter. lastModified bara där det finns ett riktigt datum.",
      action: onProdDomain
        ? "Skicka in https://sockerbagaren.se/sitemap.xml i Search Console och Bing Webmaster."
        : "Skicka in sitemap när produktionsdomänen är kopplad.",
    },
    {
      id: "gsc-tag",
      label: "GSC-verifieringskod",
      level: googleOk ? "GREEN" : "WARNING",
      detail: googleOk
        ? "HTML-meta för Google Search Console renderas."
        : "Ingen verifieringskod i miljön. Koden är redo: sätt NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.",
      action: googleOk
        ? undefined
        : "I Search Console: URL-prefix https://sockerbagaren.se → HTML-tagg → klistra in content-värdet i Vercel.",
    },
    {
      id: "gsc-property",
      label: "GSC-egenskap",
      level: "UNKNOWN",
      detail: "Kan inte utläsas från koden om egenskapen är verifierad eller om sitemap är inskickad. Ingen GSC-API-nyckel finns.",
      action: "Verifiera egenskapen och skicka in sitemap.xml. Impressions/klick syns först därefter.",
    },
    {
      id: "bing",
      label: "Bing Webmaster",
      level: bingOk ? "GREEN" : "WARNING",
      detail: bingOk
        ? "msvalidate.01-meta renderas."
        : "Ingen Bing-verifieringskod. Koden är redo: sätt NEXT_PUBLIC_BING_SITE_VERIFICATION.",
      action: bingOk
        ? undefined
        : "Bing Webmaster Tools → HTML-metatagg → klistra in värdet i Vercel.",
    },
    {
      id: "schema",
      label: "Structured data",
      level: "GREEN",
      detail: "JSON-LD med Organization, WebSite, Service (företagsfika), Product/Offer, FAQPage, BreadcrumbList och MerchantReturnPolicy. Inga påhittade betyg eller recensioner.",
      action: "Validera en produktsida och startsidan i Google Rich Results Test efter lansering.",
    },
    {
      id: "metadata",
      label: "Metadata",
      level: "GREEN",
      detail: "Unik title, description, canonical och delningskort på indexerbar sida. Preview är noindex.",
    },
    {
      id: "broken-links",
      label: "Broken links",
      level: "UNKNOWN",
      detail: "Live-crawl lagras inte i appen. CI kör seo:crawl mot ett bygge.",
      action: "Förlita er på CI-crawlen. UNKNOWN här betyder inte att länkar är trasiga.",
    },
    {
      id: "gbp",
      label: "Google Business Profile",
      level: sameAs.length > 0 ? "GREEN" : "UNKNOWN",
      detail: sameAs.length > 0
        ? `sameAs har ${sameAs.length} profil-URL:er.`
        : "Ingen GBP- eller profil-URL i NEXT_PUBLIC_SAME_AS. Local Pack kan inte vinnas från sajten ensam.",
      action: sameAs.length > 0
        ? undefined
        : "Skapa GBP som leveransverksamhet utan besöksadress, kategori Bagerigrossist, serviceområden Tyresö/Nacka/Haninge/Huddinge. Klistra in profil-URL i NEXT_PUBLIC_SAME_AS.",
    },
    {
      id: "analytics",
      label: "Mätning",
      level: ga4Ok ? "GREEN" : "UNKNOWN",
      detail: ga4Ok
        ? "GA4 laddas efter samtycke. Konverteringar skickar källklass (google/bing/…) och landningssidekluster (branded/local/product/subscription/info) utan personuppgifter."
        : "Ingen giltig NEXT_PUBLIC_GA4_ID. Organisk konvertering kan inte mätas förrän GA4 är kopplat.",
    },
    {
      id: "last-audit",
      label: "Last audit",
      level: "GREEN",
      detail: `Senaste SEO-revisionen i koden: ${LAST_SEO_AUDIT}. ${Object.keys(CONTENT_DATES).length} redaktionella sidor har lastModified.`,
    },
  ];
}

export function seoSummary(checks: SeoCheck[]): { critical: number; warning: number; unknown: number; green: number } {
  return {
    critical: checks.filter((c) => c.level === "CRITICAL").length,
    warning: checks.filter((c) => c.level === "WARNING").length,
    unknown: checks.filter((c) => c.level === "UNKNOWN").length,
    green: checks.filter((c) => c.level === "GREEN").length,
  };
}
