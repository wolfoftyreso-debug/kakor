import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveProducts, getDeliveryDaysLabel } from "@/lib/products";
import { ProductBuyBox } from "@/components/ProductBuyBox";
import { ImageSlot } from "@/components/ImageSlot";
import { IngredientList } from "@/components/IngredientList";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, graph, ids, productNode, webPageNode } from "@/lib/seo/schema";
import { PRODUCT_KNOWLEDGE } from "@/lib/product-content";
import { allergenChips } from "@/lib/allergens";
import { formatOre } from "@/lib/money";
import { priceSuffix } from "@/lib/units";

// Object.hasOwn: en admin-skapad slug som "constructor" får aldrig nå prototypkedjan.
const knowledgeFor = (slug: string) =>
  Object.hasOwn(PRODUCT_KNOWLEDGE, slug) ? PRODUCT_KNOWLEDGE[slug] : undefined;

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

function productPageTitle(product: { name: string; unit: string }): string {
  return product.unit === "paket"
    ? `${product.name} — beställ till företag`
    : `${product.name} — beställ per kilo till företag`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.active) return {};
  const title = productPageTitle(product);
  const aka = knowledgeFor(product.slug)?.aka;
  // Meta description ≤ ~155 tecken (trunkeras annars i sökresultaten).
  const description = `${product.name}${aka ? ` (${aka})` : ""} — ${formatOre(product.pricePerKgOre)}${priceSuffix(product.unit)} exkl. moms. Levereras till företag i Tyresö, Nacka, Haninge och Huddinge, betalning mot faktura.`;
  return {
    title,
    description,
    alternates: { canonical: `/kakor/${product.slug}` },
    ...sharePreview({
      title,
      description,
      path: `/kakor/${product.slug}`,
      image: { url: productOgImage(product.imageRef), alt: product.name },
    }),
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

  const [allProducts, deliveryDays] = await Promise.all([getActiveProducts(), getDeliveryDaysLabel()]);
  const cardData = allProducts.find((p) => p.id === product.id);
  if (!cardData) notFound();
  const knowledge = knowledgeFor(product.slug);
  // Styckvara som innehåller sortimentet (prova-på-paketet): visa varje
  // ingående sorts förteckning i stället för en hänvisning.
  const bundleParts =
    product.unit === "paket"
      ? (await prisma.product.findMany({ where: { active: true, unit: "kg" }, orderBy: { sortOrder: "asc" } })).filter(
          (p) => p.ingredients
        )
      : [];
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
      title: productPageTitle(product),
      description: product.description,
      breadcrumbs: crumbs,
      mainEntityId: ids.product(product.slug),
      dateModified: product.updatedAt.toISOString().slice(0, 10),
    }),
    breadcrumbNode(path, crumbs),
    productNode(cardData)
  );

  const chips = allergenChips(product.allergens);

  return (
    <>
      <JsonLd data={pageGraph} />
      <Breadcrumbs crumbs={crumbs} />
      <div className="container-medium has-sticky-buy" style={{ paddingTop: 24, paddingBottom: 64 }}>
        <div className="two-col" style={{ display: "grid", gap: 40, alignItems: "start" }}>
          <div className="card-media" style={{ minHeight: 340, borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)" }}>
            <ImageSlot label={`${product.name} — närbild`} src={product.imageRef || undefined} priority />
            {product.badge && <span className="product-badge">{product.badge}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Bakat på riktigt smör
              </div>
              <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)" }}>
                {product.name}
              </h1>
              <p className="lede" style={{ margin: "12px 0 0" }}>
                {product.description}
              </p>
            </div>
            <ProductBuyBox product={cardData} deliveryDays={deliveryDays} />
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
          {(product.ingredients || bundleParts.length > 0) && (
            <section className="card" style={{ padding: "22px 24px" }}>
              <h2 style={{ fontSize: 19, marginBottom: 10 }}>Ingredienser</h2>
              {bundleParts.length > 0 ? (
                // Paket: fullständig förteckning per ingående sort (obligatorisk
                // information före köp vid distansförsäljning, 1169/2011 art. 14).
                <div style={{ display: "grid", gap: 10 }}>
                  {bundleParts.map((part) => (
                    <div key={part.id}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{part.name}</div>
                      <IngredientList ingredients={part.ingredients} style={{ fontSize: 13.5 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <IngredientList ingredients={product.ingredients} />
              )}
            </section>
          )}
          <section className="card" style={{ padding: "22px 24px" }}>
            <h2 style={{ fontSize: 19, marginBottom: 12 }}>Allergener</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {chips.map((a) => (
                <span key={a} className="chip">
                  {a}
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
              Vi levererar till bemannade företagsadresser i{" "}
              <Link href="/tyreso">Tyresö</Link>, <Link href="/nacka">Nacka</Link>,{" "}
              <Link href="/haninge">Haninge</Link> och <Link href="/huddinge">Huddinge</Link> på
              områdets leveransdag — under dagen. Betalning mot faktura.{" "}
              <Link href="/leverans">Om leveransen</Link>
            </p>
          </section>
        </div>

        {knowledge && (
          <section style={{ marginTop: 48, maxWidth: "70ch" }}>
            <h2 className="h-sub" style={{ marginBottom: 14 }}>
              {knowledge.heading}
            </h2>
            {knowledge.paragraphs.map((p) => (
              <p
                key={p.slice(0, 24)}
                style={{ fontSize: 15, lineHeight: 1.7, color: "var(--brown-2)", margin: "0 0 14px" }}
              >
                {p}
              </p>
            ))}
          </section>
        )}

        {related.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2 className="h-sub" style={{ marginBottom: 18 }}>
              Blanda gärna med
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              {related.map((p) => (
                <Link
                  key={p.id}
                  href={`/kakor/${p.slug}`}
                  className="card card-hover"
                  style={{ overflow: "hidden", textDecoration: "none", color: "var(--text)" }}
                >
                  <div className="card-media" style={{ height: 150 }}>
                    <ImageSlot label={`${p.name} — närbild`} src={p.imageRef || undefined} />
                    {p.badge && <span className="product-badge">{p.badge}</span>}
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
                      {formatOre(p.pricePerKgOre)}
                      {priceSuffix(p.unit)} exkl. moms · blanda fritt i samma order
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="cta-band">
        <h2 className="h-section" style={{ marginBottom: 20 }}>
          Dags för riktigt fika på jobbet?
        </h2>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
      </section>
    </>
  );
}
