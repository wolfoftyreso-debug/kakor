import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { InfoPageSeo } from "@/components/InfoPageSeo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ingredienser & allergener",
  description:
    "Fullständiga ingredienser och allergener för Sockerbagarens kakor: riktigt smör, vetemjöl, strösocker och traditionella råvaror.",
  alternates: { canonical: "/ingredienser" },
  ...sharePreview({
    title: "Ingredienser & allergener",
    description:
      "Fullständiga ingredienser och allergener för Sockerbagarens kakor: riktigt smör, vetemjöl, strösocker och traditionella råvaror.",
    path: "/ingredienser",
  }),
};

export default async function IngredienserPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
    <InfoPageSeo
      path="/ingredienser"
      name="Ingredienser & allergener"
      title="Ingredienser & allergener"
      description={String(metadata.description)}
    />
    <div className="container-narrow" style={{ padding: "24px 24px 80px" }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 12 }}>
        Ingredienser &amp; allergener
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Smör ska smaka smör. Våra kakor bakas på riktigt smör, vanligt strösocker och kvalitativa
        traditionella råvaror — inga onödiga tillsatser.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 36px" }}>
        <span className="badge-butter">RIKTIGT SMÖR</span>
        <span className="badge-butter">STRÖSOCKER</span>
        <span className="badge-butter">VETEMJÖL</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {products.map((p) => (
          <div key={p.id} className="card" style={{ padding: "24px 26px" }}>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>{p.name}</h2>
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 14px" }}>{p.description}</p>
            {p.ingredients && (
              <>
                <div className="section-label" style={{ marginBottom: 6 }}>INGREDIENSER</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 14px" }}>{p.ingredients}</p>
              </>
            )}
            <div className="section-label" style={{ marginBottom: 8 }}>ALLERGENER</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.allergens
                .replace(/^Innehåller /, "")
                .replace(/\.$/, "")
                .split(/,| Kan innehålla spår av/)
                .map((a) => a.trim())
                .filter(Boolean)
                .map((a) => (
                  <span key={a} className="chip">
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </span>
                ))}
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-2)", margin: "12px 0 0" }}>{p.allergens}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 28, maxWidth: "60ch" }}>
        Har ni frågor om allergener eller behöver detaljerad information inför en beställning?
        Kontakta oss så hjälper vi er.
      </p>
    </div>

      <section style={{ background: "var(--butter)", padding: "56px 24px", textAlign: "center", marginTop: 48 }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 30px)", marginBottom: 18 }}>
          Riktiga råvaror, levererade till er arbetsplats
        </h2>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
      </section>
    </>
  );
}
