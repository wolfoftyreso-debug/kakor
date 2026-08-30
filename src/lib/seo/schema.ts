// =====================================================================
// SCHEMA-MOTOR
// Centraliserad JSON-LD-generering från riktig applikationsdata.
// Regler:
//  - Varje egenskap kommer från synligt innehåll, verifierad data eller
//    auktoritativ konfiguration (src/lib/config.ts). Ingenting hittas på:
//    inga ratings, reviews, öppettider, telefonnummer eller geokoordinater
//    förrän verksamheten verifierat dem.
//  - Stabil @id-strategi:
//      {SITE}/#organization   kanonisk organisation (Bakery ⊂ LocalBusiness ⊂ Organization)
//      {SITE}/#website        webbplatsen
//      {url}#webpage          sidentitet
//      {url}#breadcrumbs      sidans brödsmulelista
//      {SITE}/#product-{slug} produktentitet
//  - Entiteter kopplas via @id-referenser till EN sammanhängande graf,
//    aldrig som frikopplade JSON-objekt.
// =====================================================================

import { siteConfig, invoiceConfig } from "@/lib/config";
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
 * Kanonisk organisationsentitet. Typen Bakery är en subtyp av både
 * LocalBusiness och Organization — EN entitet med ETT stabilt @id
 * återanvänds överallt (publisher, seller, breadcrumb-hem osv).
 * Adressen är verifierad via designunderlaget/fakturakonfigurationen.
 */
export function organizationNode(): JsonLdNode {
  return {
    "@type": ["Organization", "Bakery"],
    "@id": ids.organization(),
    name: siteConfig.name,
    legalName: invoiceConfig.companyName,
    url: `${SITE()}/`,
    description: siteConfig.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: invoiceConfig.address,
      postalCode: invoiceConfig.postalCode,
      addressLocality: invoiceConfig.city,
      addressCountry: "SE",
    },
    areaServed: ["Tyresö", "Nacka", "Haninge", "Huddinge"],
    servesCuisine: "Svenska småkakor",
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
export function productNode(product: ProductCardData): JsonLdNode {
  return {
    "@type": "Product",
    "@id": ids.product(product.slug),
    name: product.name,
    description: product.description,
    url: `${SITE()}/kakor/${product.slug}`,
    ...(product.imageRef ? { image: `${SITE()}${product.imageRef}` } : {}),
    brand: { "@id": ids.organization() },
    offers: {
      "@type": "Offer",
      priceCurrency: "SEK",
      price: (product.pricePerKgOre / 100).toFixed(2),
      // B2B-pris per kilo, exklusive moms — måste deklareras så att priset
      // i sökresultat inte utger sig för att vara konsumentpris inkl. moms.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (product.pricePerKgOre / 100).toFixed(2),
        priceCurrency: "SEK",
        valueAddedTaxIncluded: false,
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "KGM" },
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

/** Bygger en @graph av noder — en <script>-tagg per sida. */
export function graph(...nodes: (JsonLdNode | null | undefined)[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter(Boolean) as JsonLdNode[],
  };
}
