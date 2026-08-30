import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { getActiveProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, productListNode, productNode, webPageNode } from "@/lib/seo/schema";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

// Titel/description breddade mot kategorins verkliga sökfält (Semrush se):
// "småkakor" 8 100 sök/mån, "fikabröd" 1 600, "kaffebröd" 590.
const PAGE_TITLE = "Småkakor & fikabröd — beställ per kilo";
const PAGE_DESCRIPTION =
  "Klassiska svenska småkakor — mandelkubb, kolasnittar och chokladsnittar bakade på riktigt smör. Fikabröd per kilo till företag i södra Stockholm: blanda fritt i samma order, betalning mot faktura.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/kakor" },
  ...sharePreview({ title: PAGE_TITLE, description: PAGE_DESCRIPTION, path: "/kakor" }),
};

// Renderas synligt längst ner på sidan + som FAQPage-schema (samma text).
// Svaren är generell bakkunskap — inga verksamhetslöften.
const KAKOR_FAQS = [
  {
    q: "Hur förvarar man småkakor bäst?",
    a: "I en tät burk i rumstemperatur, gärna med bakplåtspapper mellan lagren. Undvik kylskåp — kakor tar lätt smak och mister sin konsistens i kyla.",
  },
  {
    q: "Hur länge håller kakor i frysen?",
    a: "Småkakor tål frysning mycket bra. Frys i tät påse eller burk och låt tina i rumstemperatur — konsistens och smak håller sig i flera månader.",
  },
  {
    q: "Vilka är sju sorters kakor?",
    a: "En klassisk svensk kaffebjudningstradition: minst sju olika småkakor på bordet. Mandelkubb, kolasnittar och chokladsnittar är tre av klassikerna som ofta ingår.",
  },
  {
    q: "Hur mycket kakor går det åt per person?",
    a: "Räkna ungefär 3–5 småkakor per person till en fika. Ett kilo räcker i regel till 15–25 personer beroende på sort och hur hungrigt sällskapet är.",
  },
];

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Kakor", path: "/kakor" },
];

export default async function KakorPage() {
  const products = await getActiveProducts();

  const pageGraph = graph(
    webPageNode({
      path: "/kakor",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      breadcrumbs: CRUMBS,
      pageType: "CollectionPage",
      mainEntityId: `${siteConfig.url.replace(/\/$/, "")}/kakor#products`,
    }),
    breadcrumbNode("/kakor", CRUMBS),
    productListNode("/kakor", products),
    ...products.map(productNode),
    faqNode("/kakor", KAKOR_FAQS)
  );

  return (
    <>
      <JsonLd data={pageGraph} />
      <Breadcrumbs crumbs={CRUMBS} />
      <div className="container-medium" style={{ padding: "24px 24px 80px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Våra kakor</h1>
          <div style={{ fontSize: 14, color: "var(--text-2)" }}>
            Säljs per kilo · blanda fritt i samma order
          </div>
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch", margin: "0 0 28px" }}>
          Klassiska svenska småkakor — fikabröd bakat på riktigt smör, vanligt strösocker och
          kvalitativa traditionella råvaror. Vi levererar till arbetsplatser i Tyresö, Nacka,
          Haninge och Huddinge — betalning sker alltid mot faktura.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} headingLevel="h2" />
          ))}
        </div>
        <div style={{ marginTop: 32, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/bestall" className="btn btn-primary btn-lg">
            Beställ kakor
          </Link>
          <Link href="/prenumeration" className="btn btn-butter btn-lg">
            Starta fikaprenumeration
          </Link>
        </div>

        <section style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 28px)", marginBottom: 8 }}>
            Vanliga frågor om småkakor
          </h2>
          <div>
            {KAKOR_FAQS.map((f) => (
              <div key={f.q} style={{ borderBottom: "1px solid var(--border)", padding: "16px 4px" }}>
                <h3 style={{ fontSize: "15.5px", fontWeight: 700, fontFamily: "var(--font-sans)" }}>{f.q}</h3>
                <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--brown-2)", marginTop: 6, maxWidth: "65ch" }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
