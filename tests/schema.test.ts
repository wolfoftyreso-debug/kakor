import { describe, expect, it } from "vitest";
import {
  breadcrumbNode,
  graph,
  ids,
  organizationNode,
  productListNode,
  productNode,
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
    expect(org).not.toHaveProperty("foundingDate");
    expect(org).not.toHaveProperty("servesCuisine");
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
    const offer = node.offers as Record<string, unknown>;
    expect(offer.price).toBe("295.00");
    expect(offer.priceCurrency).toBe("SEK");
    expect(offer.seller).toEqual({ "@id": ids.organization() });
    expect(node).not.toHaveProperty("aggregateRating");
    expect(node).not.toHaveProperty("review");
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
});
