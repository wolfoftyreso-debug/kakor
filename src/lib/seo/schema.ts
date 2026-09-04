// =====================================================================
// SCHEMA-MOTOR
// Centraliserad JSON-LD-generering från riktig applikationsdata.
// Regler:
//  - Varje egenskap kommer från synligt innehåll, verifierad data eller
//    auktoritativ konfiguration (src/lib/config.ts). Ingenting hittas på:
//    inga ratings, reviews, öppettider, telefonnummer eller geokoordinater
//    förrän verksamheten verifierat dem.
//  - Stabil @id-strategi:
//      {SITE}/#organization   kanonisk organisation
//      {SITE}/#website        webbplatsen
//      {url}#webpage          sidentitet
//      {url}#breadcrumbs      sidans brödsmulelista
//      {SITE}/#product-{slug} produktentitet
//  - Entiteter kopplas via @id-referenser till EN sammanhängande graf,
//    aldrig som frikopplade JSON-objekt.
// =====================================================================

import { siteConfig, invoiceConfig, isVerifiedValue } from "@/lib/config";
import type { ProductCardData } from "@/components/ProductCard";

type JsonLdNode = Record<string, unknown>;

const SITE = () => siteConfig.url.replace(/\/$/, "");

export const ids = {
  organization: () => `${SITE()}/#organization`,
  website: () => `${SITE()}/#website`,
  webpage: (path: string) => `${SITE()}${path}#webpage`,
  breadcrumbs: (path: string) => `${SITE()}${path}#breadcrumbs`,
  product: (slug: string) => `${SITE()}/#product-${slug}`,
};

/**
 * Kanonisk organisationsentitet — EN entitet med ETT stabilt @id
 * återanvänds överallt (publisher, seller, breadcrumb-hem osv).
 * Typen är Organization, INTE Bakery/LocalBusiness: verksamheten har
 * inget bageri/besökslokal att deklarera (verksamhetens uppgift).
 * Adressen är den registrerade fakturaadressen från konfigurationen.
 */
const SAME_AS = (process.env.NEXT_PUBLIC_SAME_AS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter((v) => /^https?:\/\//.test(v));

export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ids.organization(),
    name: siteConfig.name,
    legalName: invoiceConfig.companyName,
    url: `${SITE()}/`,
    description: siteConfig.description,
    logo: `${SITE()}/images/icon-512.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: invoiceConfig.address,
      postalCode: invoiceConfig.postalCode,
      addressLocality: invoiceConfig.city,
      addressCountry: "SE",
    },
    areaServed: ["Tyresö", "Nacka", "Haninge", "Huddinge"].map((name) => ({ "@type": "City", name })),
    // Kopplingar till profiler (Google Business Profile, hitta.se, LinkedIn …)
    // sätts i NEXT_PUBLIC_SAME_AS som kommaseparerad lista när de finns.
    ...(SAME_AS.length > 0 ? { sameAs: SAME_AS } : {}),
    ...(isVerifiedValue(invoiceConfig.email)
      ? { contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: invoiceConfig.email, availableLanguage: "sv" } }
      : {}),
    ...(isVerifiedValue(invoiceConfig.vatNumber) ? { vatID: invoiceConfig.vatNumber } : {}),
    taxID: invoiceConfig.orgNumber,
  };
}

export function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": ids.website(),
    url: `${SITE()}/`,
    name: siteConfig.name,
    inLanguage: "sv-SE",
    publisher: { "@id": ids.organization() },
  };
}

export interface Crumb {
  name: string;
  path: string; // "/" eller "/tyreso"
}

export function breadcrumbNode(path: string, crumbs: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    "@id": ids.breadcrumbs(path),
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE()}${c.path === "/" ? "/" : c.path}`,
    })),
  };
}

export interface WebPageOptions {
  path: string;
  title: string;
  description?: string;
  /** Sätts när sidan har en synlig brödsmulerad (schema ska spegla synligt UI). */
  breadcrumbs?: Crumb[];
  /** @id till sidans huvudentitet, om en sådan finns. */
  mainEntityId?: string;
  /** T.ex. "CollectionPage" — annars WebPage. */
  pageType?: "WebPage" | "CollectionPage";
  dateModified?: string; // ISO-datum, endast vid verklig innehållsändring
}

export function webPageNode(opts: WebPageOptions): JsonLdNode {
  const node: JsonLdNode = {
    "@type": opts.pageType ?? "WebPage",
    "@id": ids.webpage(opts.path),
    url: `${SITE()}${opts.path === "/" ? "/" : opts.path}`,
    name: opts.title,
    inLanguage: "sv-SE",
    isPartOf: { "@id": ids.website() },
    about: { "@id": ids.organization() },
  };
  if (opts.description) node.description = opts.description;
  if (opts.breadcrumbs) node.breadcrumb = { "@id": ids.breadcrumbs(opts.path) };
  if (opts.mainEntityId) node.mainEntity = { "@id": opts.mainEntityId };
  if (opts.dateModified) node.dateModified = opts.dateModified;
  return node;
}

/**
 * Produktentitet från databasen. Kanonisk entitets-URL är produktens egen
 * sida (/kakor/<slug>) — samma @id återanvänds överallt där produkten
 * refereras. Priset är sajtens faktiska försäljningspris (per kilo).
 * Inga ratings/recensioner — sådana finns inte verifierade.
 */
// Google vill ha flera bildformat (1:1, 4:3, 16:9) för produktresultat. Vi
// levererar de varianter som finns i /public/images: <namn>-square.jpg,
// <namn>-og.jpg (1200×630) och originalbilden. Saknas en variant hoppas den
// över — inga länkar till filer som inte finns.
const PRODUCT_IMAGE_VARIANTS: Record<string, string[]> = {
  "/images/kolasnittar.jpg": ["/images/kolasnittar-square.jpg", "/images/kolasnittar.jpg", "/images/kolasnittar-og.jpg"],
  "/images/mandelkubb.jpg": ["/images/mandelkubb-square.jpg", "/images/mandelkubb.jpg", "/images/mandelkubb-og.jpg"],
  "/images/chokladsnittar.jpg": ["/images/chokladsnittar-square.jpg", "/images/chokladsnittar.jpg", "/images/chokladsnittar-og.jpg"],
};
function productImages(imageRef: string): string[] {
  const variants = PRODUCT_IMAGE_VARIANTS[imageRef] ?? [imageRef];
  return variants.map((v) => `${SITE()}${v}`);
}

export function productNode(product: ProductCardData): JsonLdNode {
  return {
    "@type": "Product",
    "@id": ids.product(product.slug),
    name: product.name,
    description: product.description,
    url: `${SITE()}/kakor/${product.slug}`,
    ...(product.imageRef ? { image: productImages(product.imageRef) } : {}),
    category: "Småkakor",
    brand: { "@id": ids.organization() },
    offers: {
      "@type": "Offer",
      priceCurrency: "SEK",
      price: (product.pricePerKgOre / 100).toFixed(2),
      url: `${SITE()}/kakor/${product.slug}`,
      // Endast företagskunder, endast Sverige — så att sökmotorer inte visar
      // priset som ett konsumentpris.
      eligibleCustomerType: "https://schema.org/Business",
      eligibleRegion: { "@type": "Country", name: "SE" },
      // B2B-pris per kilo, exklusive moms — måste deklareras så att priset
      // i sökresultat inte utger sig för att vara konsumentpris inkl. moms.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (product.pricePerKgOre / 100).toFixed(2),
        priceCurrency: "SEK",
        valueAddedTaxIncluded: false,
        // KGM = kilogram (lösvikt), PK = paket/kolli (styckvara, UN/CEFACT).
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitCode: product.unit === "paket" ? "PK" : "KGM",
        },
      },
      availability: "https://schema.org/InStock",
      seller: { "@id": ids.organization() },
    },
  };
}

export function productListNode(path: string, products: ProductCardData[]): JsonLdNode {
  return {
    "@type": "ItemList",
    "@id": `${SITE()}${path}#products`,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@id": ids.product(p.slug) },
    })),
  };
}

/**
 * FAQPage-nod — används ENDAST för frågor/svar som faktiskt visas på sidan,
 * med exakt samma text. Aldrig påhittade frågor.
 */
/**
 * Artikelnod för kunskaps-/guidesidor: rubrik, publicerings- och ändringsdatum,
 * bild och utgivare (organisationen). Datumen sätts av verksamheten vid
 * verklig innehållsändring — aldrig byggtid.
 */
export function articleNode(opts: {
  path: string;
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified: string;
}): JsonLdNode {
  return {
    "@type": "Article",
    "@id": `${SITE()}${opts.path}#article`,
    headline: opts.headline,
    description: opts.description,
    image: `${SITE()}${opts.image}`,
    inLanguage: "sv-SE",
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: { "@id": ids.organization() },
    publisher: { "@id": ids.organization() },
    mainEntityOfPage: { "@id": ids.webpage(opts.path) },
    isPartOf: { "@id": ids.website() },
  };
}

export function faqNode(path: string, faqs: { q: string; a: string }[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": `${SITE()}${path}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Bygger en @graph av noder — en <script>-tagg per sida. */
export function graph(...nodes: (JsonLdNode | null | undefined)[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter(Boolean) as JsonLdNode[],
  };
}
