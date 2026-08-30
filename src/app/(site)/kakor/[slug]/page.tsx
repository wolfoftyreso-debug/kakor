import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveProducts } from "@/lib/products";
import { ProductBuyBox } from "@/components/ProductBuyBox";
import { ImageSlot } from "@/components/ImageSlot";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, graph, ids, productNode, webPageNode } from "@/lib/seo/schema";
import { formatOre } from "@/lib/money";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.active) return {};
  const title = `${product.name} — beställ per kilo till företag`;
  const description = `${product.description} ${formatOre(product.pricePerKgOre)}/kg. Levereras till arbetsplatser i Tyresö, Nacka, Haninge och Huddinge — betalning mot faktura.`;
  return {
    title,
    description,
    alternates: { canonical: `/kakor/${product.slug}` },
    openGraph: {
      title: `${title} — Sockerbagaren`,
      description,
      url: `/kakor/${product.slug}`,
      siteName: "Sockerbagaren",
      locale: "sv_SE",
      type: "website",
      images: [{ url: productOgImage(product.imageRef), width: 1200, height: 630, alt: product.name }],
    },
  };
}

// Delningsbild: 1200x630-beskärningen av produktfotot om den finns,
// annars själva produktbilden, annars varumärkesbilden.
function productOgImage(imageRef: string): string {
  if (!imageRef) return "/og.jpg";
  const ogVariant = imageRef.replace(/\.(jpe?g|png|webp)$/i, "-og.jpg");
  try {
    if (ogVariant !== imageRef && existsSync(join(process.cwd(), "public", ogVariant))) {
      return ogVariant;
    }
  } catch {
    // fall igenom till produktbilden
  }
  return imageRef;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.active) notFound();

  const allProducts = await getActiveProducts();
  const cardData = allProducts.find((p) => p.id === product.id);
  if (!cardData) notFound();
  const related = allProducts.filter((p) => p.id !== product.id);

  const path = `/kakor/${product.slug}`;
  const crumbs = [
    { name: "Sockerbagaren", path: "/" },
    { name: "Kakor", path: "/kakor" },
    { name: product.name, path },
  ];

  const pageGraph = graph(
    webPageNode({
      path,
      title: `${product.name} — beställ per kilo till företag`,
      description: product.description,
      breadcrumbs: crumbs,
      mainEntityId: ids.product(product.slug),
      dateModified: product.updatedAt.toISOString().slice(0, 10),
    }),
    breadcrumbNode(path, crumbs),
    productNode(cardData)
  );

  const allergenChips = product.allergens
    .replace(/^Innehåller /, "")
    .replace(/\.$/, "")
    .split(/,| Kan innehålla spår av/)
    .map((a) => a.trim())
    .filter(Boolean);

  return (
    <>
      <JsonLd data={pageGraph} />
      <Breadcrumbs crumbs={crumbs} />
      <div className="container-medium" style={{ padding: "24px 24px 64px" }}>
        <div className="two-col" style={{ display: "grid", gap: 40, alignItems: "start" }}>
          <div style={{ minHeight: 340, borderRadius: 8, overflow: "hidden" }}>
            <ImageSlot label={`${product.name} — närbild`} src={product.imageRef || undefined} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Bakat på riktigt smör
              </div>
              <h1 style={{ fontSize: "clamp(30px, 4.5vw, 42px)", lineHeight: 1.12, letterSpacing: "-0.5px" }}>
                {product.name}
              </h1>
              <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: "12px 0 0", color: "var(--brown-2)" }}>
                {product.description}
              </p>
            </div>
            <ProductBuyBox product={cardData} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginTop: 48,
          }}
        >
          {product.ingredients && (
            <section className="card" style={{ padding: "22px 24px" }}>
              <h2 style={{ fontSize: 19, marginBottom: 10 }}>Ingredienser</h2>
              <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.65 }}>{product.ingredients}</p>
            </section>
          )}
          <section className="card" style={{ padding: "22px 24px" }}>
            <h2 style={{ fontSize: 19, marginBottom: 12 }}>Allergener</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {allergenChips.map((a) => (
                <span key={a} className="chip">
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </span>
              ))}
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-2)", margin: "12px 0 0" }}>
              {product.allergens}{" "}
              <Link href="/ingredienser">Alla ingredienser &amp; allergener</Link>
            </p>
          </section>
          <section className="card" style={{ padding: "22px 24px" }}>
            <h2 style={{ fontSize: 19, marginBottom: 10 }}>Så levereras den</h2>
            <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.65, color: "var(--brown-2)" }}>
              Vi bakar färskt och kör själva ut till bemannade företagsadresser i{" "}
              <Link href="/tyreso">Tyresö</Link>, <Link href="/nacka">Nacka</Link>,{" "}
              <Link href="/haninge">Haninge</Link> och <Link href="/huddinge">Huddinge</Link> på
              områdets leveransdag — under dagen. Betalning mot faktura.{" "}
              <Link href="/leverans">Om leveransen</Link>
            </p>
          </section>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", marginBottom: 18 }}>
              Blanda gärna med
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              {related.map((p) => (
                <Link
                  key={p.id}
                  href={`/kakor/${p.slug}`}
                  className="card"
                  style={{ overflow: "hidden", textDecoration: "none", color: "var(--text)" }}
                >
                  <div style={{ height: 150 }}>
                    <ImageSlot label={`${p.name} — närbild`} src={p.imageRef || undefined} />
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
                      {formatOre(p.pricePerKgOre)}/kg · blanda fritt i samma order
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <section style={{ background: "var(--butter)", padding: "56px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", marginBottom: 18 }}>
          Dags för riktigt fika på jobbet?
        </h2>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
      </section>
    </>
  );
}
