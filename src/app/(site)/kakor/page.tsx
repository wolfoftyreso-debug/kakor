import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { getActiveProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, graph, productListNode, productNode, webPageNode } from "@/lib/seo/schema";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Våra kakor — beställ per kilo",
  description:
    "Mandelkubb, kolasnittar och chokladsnittar bakade på riktigt smör — säljs per kilo till företag i södra Stockholm. Blanda fritt i samma order, betalning mot faktura.",
  alternates: { canonical: "/kakor" },
  ...sharePreview({
    title: "Våra kakor — beställ per kilo",
    description:
      "Mandelkubb, kolasnittar och chokladsnittar bakade på riktigt smör — säljs per kilo till företag i södra Stockholm. Blanda fritt i samma order, betalning mot faktura.",
    path: "/kakor",
  }),
};

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Kakor", path: "/kakor" },
];

export default async function KakorPage() {
  const products = await getActiveProducts();

  const pageGraph = graph(
    webPageNode({
      path: "/kakor",
      title: "Våra kakor — beställ per kilo",
      description: String(metadata.description),
      breadcrumbs: CRUMBS,
      pageType: "CollectionPage",
      mainEntityId: `${siteConfig.url.replace(/\/$/, "")}/kakor#products`,
    }),
    breadcrumbNode("/kakor", CRUMBS),
    productListNode("/kakor", products),
    ...products.map(productNode)
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
          Klassiska svenska småkakor bakade på riktigt smör, vanligt strösocker och kvalitativa
          traditionella råvaror. Vi levererar till arbetsplatser i Tyresö, Nacka, Haninge och
          Huddinge — betalning sker alltid mot faktura.
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
      </div>
    </>
  );
}
