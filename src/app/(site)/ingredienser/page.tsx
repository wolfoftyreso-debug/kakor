import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { prisma } from "@/lib/db";
import { allergenChips } from "@/lib/allergens";
import { IngredientList } from "@/components/IngredientList";
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
      <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)", marginBottom: 14 }}>
        Ingredienser &amp; allergener
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Smör ska smaka smör. Våra kakor bakas på riktigt smör, vanligt strösocker och kvalitativa
        traditionella råvaror. Allergener är markerade i fetstil i varje förteckning.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 36px" }}>
        <span className="badge-butter">RIKTIGT SMÖR</span>
        <span className="badge-butter">STRÖSOCKER</span>
        <span className="badge-butter">VETEMJÖL</span>
        <span className="badge-butter">MÖRK CHOKLAD</span>
        <span className="badge-butter">ÄGG</span>
        <span className="badge-butter">MANDEL</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {products.map((p) => (
          <div key={p.id} className="card" style={{ padding: "24px 26px" }}>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>
              <Link href={`/kakor/${p.slug}`} style={{ color: "inherit" }}>{p.name}</Link>
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 14px" }}>{p.description}</p>
            {p.unit === "paket" ? (
              <>
                <div className="section-label" style={{ marginBottom: 6 }}>INGREDIENSER PER SORT</div>
                <div style={{ display: "grid", gap: 8, margin: "0 0 14px" }}>
                  {products
                    .filter((q) => q.unit === "kg" && q.ingredients)
                    .map((q) => (
                      <div key={q.id}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{q.name}</div>
                        <IngredientList ingredients={q.ingredients} style={{ fontSize: 14 }} />
                      </div>
                    ))}
                </div>
              </>
            ) : (
              p.ingredients && (
                <>
                  <div className="section-label" style={{ marginBottom: 6 }}>INGREDIENSER</div>
                  <IngredientList ingredients={p.ingredients} style={{ fontSize: 14, marginBottom: 14 }} />
                </>
              )
            )}
            <div className="section-label" style={{ marginBottom: 8 }}>ALLERGENER</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {allergenChips(p.allergens).map((a) => (
                <span key={a} className="chip">
                  {a}
                </span>
              ))}
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-2)", margin: "12px 0 0" }}>{p.allergens}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 28, maxWidth: "60ch" }}>
        Ovan finns hela innehållet för varje kaksort — allt ni behöver veta inför en beställning.
        Beställ direkt i webbshoppen, så skapas fakturan vid ordern och mejlas till er.
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
