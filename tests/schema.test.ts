import { describe, expect, it } from "vitest";
import {
  breadcrumbNode,
  DELIVERY_CITIES,
  faqNode,
  graph,
  ids,
  merchantReturnPolicyNode,
  organizationNode,
  productListNode,
  productNode,
  serviceNode,
  webPageNode,
  websiteNode,
} from "@/lib/seo/schema";
import type { ProductCardData } from "@/components/ProductCard";

// Schema-motorn: stabil @id-strategi, sammanhängande graf, inga påhittade fält.

const product: ProductCardData = {
  id: "x",
  slug: "kolasnittar",
  name: "Kolasnittar",
  description: "Spröda, smöriga och precis lagom sega.",
  pricePerKgOre: 29500,
  unit: "kg",
  packageWeightGrams: 0,
  weightOptions: [1, 2, 3],
  allergens: "Innehåller vete, smör (mjölk).",
  imageRef: "/images/kolasnittar.jpg",
  badge: "Bästsäljare",
  vatRateBp: 1200,
  piecesPerKgApprox: null,
};

describe("schema-motorn", () => {
  it("använder stabila @id:n", () => {
    expect(ids.organization()).toMatch(/#organization$/);
    expect(ids.website()).toMatch(/#website$/);
    expect(ids.webpage("/tyreso")).toMatch(/\/tyreso#webpage$/);
    expect(ids.product("kolasnittar")).toMatch(/#product-kolasnittar$/);
  });

  it("organisationen är EN entitet (Organization — inget bageri att deklarera)", () => {
    const org = organizationNode();
    // Verksamheten har inget bageri/besökslokal — aldrig Bakery/LocalBusiness.
    expect(org["@type"]).toBe("Organization");
    expect(org["@id"]).toBe(ids.organization());
    const address = org.address as Record<string, string>;
    expect(address.streetAddress).toBe("Antennvägen 2");
    expect(address.addressCountry).toBe("SE");
    // Inga påhittade signaler:
    expect(org).not.toHaveProperty("aggregateRating");
    expect(org).not.toHaveProperty("review");
    expect(org).not.toHaveProperty("openingHoursSpecification");
    expect(org).not.toHaveProperty("telephone");
    // Grundat 2025 är verksamhetens egen uppgift (berättelsen på /om) – inget mer precist än året.
    expect(org.foundingDate).toBe("2025");
    expect(org.vatID).toBe("SE559141704201");
    expect(org.taxID).toBe("559141-7042");
    expect(org).not.toHaveProperty("servesCuisine");
    expect(org.makesOffer).toEqual({ "@id": ids.service() });
    const logo = org.logo as Record<string, unknown>;
    expect(logo["@type"]).toBe("ImageObject");
    expect(logo.width).toBe(512);
    expect(org.knowsAbout).toEqual(expect.arrayContaining(["Småkakor", "Kontorsfika"]));
    const retur = org.hasMerchantReturnPolicy as { "@id": string };
    expect(retur["@id"]).toBe(ids.returnPolicy());
  });

  it("webbplatsen refererar organisationen via @id (graf, inte kopior)", () => {
    const site = websiteNode();
    expect(site.publisher).toEqual({ "@id": ids.organization() });
    expect(site.inLanguage).toBe("sv-SE");
  });

  it("sidnoder kopplas till webbplats, organisation och brödsmulor", () => {
    const crumbs = [
      { name: "Sockerbagaren", path: "/" },
      { name: "Tyresö", path: "/tyreso" },
    ];
    const page = webPageNode({ path: "/tyreso", title: "T", breadcrumbs: crumbs });
    expect(page.isPartOf).toEqual({ "@id": ids.website() });
    expect(page.breadcrumb).toEqual({ "@id": ids.breadcrumbs("/tyreso") });

    const bc = breadcrumbNode("/tyreso", crumbs);
    const items = bc.itemListElement as { position: number; name: string; item: string }[];
    expect(items).toHaveLength(2);
    expect(items[0].position).toBe(1);
    expect(items[1].item).toMatch(/\/tyreso$/);
  });

  it("dateModified sätts bara när den skickas in explicit", () => {
    expect(webPageNode({ path: "/", title: "x" })).not.toHaveProperty("dateModified");
    expect(webPageNode({ path: "/", title: "x", dateModified: "2026-08-29" }).dateModified).toBe(
      "2026-08-29"
    );
  });

  it("produktnoden speglar databasens pris och säljare via @id — inga ratings", () => {
    const node = productNode(product);
    expect(node["@id"]).toBe(ids.product("kolasnittar"));
    // Kanonisk entitets-URL = produktens egen sida.
    expect(node.url).toMatch(/\/kakor\/kolasnittar$/);
    // Produktfoto med absolut URL; utelämnas helt när referens saknas.
    // Flera bildformat (1:1, 4:3, 16:9) för Googles produktresultat — originalet ingår alltid.
    expect(Array.isArray(node.image)).toBe(true);
    expect((node.image as string[]).some((u) => /\/images\/kolasnittar\.jpg$/.test(u))).toBe(true);
    expect((node.image as string[]).some((u) => /kolasnittar-square\.jpg$/.test(u))).toBe(true);
    expect(node.category).toBe("Småkakor");
    expect(productNode({ ...product, imageRef: "" })).not.toHaveProperty("image");
    const origin = node.countryOfOrigin as { name: string };
    expect(origin.name).toBe("Litauen");
    const offer = node.offers as Record<string, unknown>;
    expect(offer.price).toBe("295.00");
    expect(offer.priceCurrency).toBe("SEK");
    expect(offer.itemCondition).toBe("https://schema.org/NewCondition");
    expect(offer.seller).toEqual({ "@id": ids.organization() });
    const retur = offer.hasMerchantReturnPolicy as { "@id": string };
    expect(retur["@id"]).toBe(ids.returnPolicy());
    const shipping = offer.shippingDetails as { shippingDestination: { addressCountry: string; addressLocality?: string; postalCode?: string }[] };
    expect(shipping.shippingDestination.map((d) => d.addressLocality)).toEqual([...DELIVERY_CITIES]);
    expect(shipping.shippingDestination.every((d) => d.addressCountry === "SE")).toBe(true);
    const withPost = productNode(product, ["135", "131"]);
    const postShipping = (withPost.offers as { shippingDetails: { shippingDestination: { postalCodePrefix: string }[] } }).shippingDetails;
    expect(postShipping.shippingDestination.map((d) => d.postalCodePrefix)).toEqual(["135", "131"]);
    expect(node).not.toHaveProperty("aggregateRating");
    expect(node).not.toHaveProperty("review");
  });

  it("returpolicyn är ingen ångerrätt och pekar på villkoren", () => {
    const node = merchantReturnPolicyNode();
    expect(node["@type"]).toBe("MerchantReturnPolicy");
    expect(node.returnPolicyCategory).toBe("https://schema.org/MerchantReturnNotPermitted");
    expect(node.applicableCountry).toBe("SE");
    expect(String(node.merchantReturnLink)).toMatch(/\/villkor$/);
  });

  it("FAQPage speglar exakt de synliga frågorna och är tom-säker", () => {
    const node = faqNode("/kakor", [{ q: "Hur betalar vi?", a: "Mot faktura." }]);
    expect(node["@type"]).toBe("FAQPage");
    const entities = node.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe("Hur betalar vi?");
    expect(entities[0].acceptedAnswer.text).toBe("Mot faktura.");
  });

  it("produktlistan refererar produkter via @id", () => {
    const list = productListNode("/", [product]);
    const items = list.itemListElement as { item: { "@id": string } }[];
    expect(items[0].item["@id"]).toBe(ids.product("kolasnittar"));
  });

  it("graph() bygger EN @graph och filtrerar bort tomma noder", () => {
    const g = graph(organizationNode(), null, websiteNode(), undefined);
    expect(g["@context"]).toBe("https://schema.org");
    expect((g["@graph"] as unknown[]).length).toBe(2);
  });

  it("företagsfika är en Service kopplad till organisationen – inte LocalBusiness", () => {
    const service = serviceNode();
    expect(service["@type"]).toBe("Service");
    expect(service["@id"]).toBe(ids.service());
    expect(service.provider).toEqual({ "@id": ids.organization() });
    expect(service).not.toHaveProperty("aggregateRating");
    expect(service).not.toHaveProperty("review");
    const cities = (service.areaServed as { name: string }[]).map((c) => c.name);
    expect(cities).toEqual([...DELIVERY_CITIES]);
    expect(webPageNode({ path: "/om", title: "Om", pageType: "AboutPage" })["@type"]).toBe("AboutPage");
  });
});
