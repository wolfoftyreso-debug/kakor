import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { invoiceConfig } from "@/lib/config";
import { highlightAllergens } from "@/lib/allergens";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — etiketter", robots: { index: false } };

// Etikett för färdigförpackade livsmedel (förordning (EU) 1169/2011 och
// LIVSFS 2014:4): beteckning, ingrediensförteckning med allergener framhävda,
// nettokvantitet, bäst före-datum, förvaringsanvisning och ansvarig
// livsmedelsföretagare. Datumet skrivs för hand per sats — det hittas inte på.
export default async function LabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gram?: string; antal?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { gram, antal } = await searchParams;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const defaultGrams = product.unit === "paket" && product.packageWeightGrams > 0 ? product.packageWeightGrams : 1000;
  const grams = Math.min(20000, Math.max(50, parseInt(gram ?? "", 10) || defaultGrams));
  const count = Math.min(24, Math.max(1, parseInt(antal ?? "", 10) || 8));
  const segments = highlightAllergens(product.ingredients);
  const netto = grams >= 1000 && grams % 100 === 0 ? `${(grams / 1000).toString().replace(".", ",")} kg` : `${grams} g`;

  return (
    <>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Etiketter: {product.name}</h1>
          <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "6px 0 0", maxWidth: "70ch" }}>
            Ingredienserna och allergenerna hämtas från produkten. Bäst före-datum och satsnummer
            fylls i för hand per bakning. Två etiketter i bredd på A4.
          </p>
        </div>
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="field" style={{ margin: 0 }}>
            Nettovikt (gram)
            <input name="gram" type="number" min="50" max="20000" step="50" defaultValue={grams} style={{ width: 120 }} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            Antal etiketter
            <input name="antal" type="number" min="1" max="24" defaultValue={count} style={{ width: 90 }} />
          </label>
          <button type="submit" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
            Uppdatera
          </button>
          <PrintButton label="Skriv ut" />
          <Link href={`/admin/produkter/${product.id}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
            Tillbaka
          </Link>
        </form>
      </div>

      {!product.ingredients && (
        <p className="error-text no-print" role="alert">
          Produkten saknar ingrediensförteckning — fyll i den under Redigera innan etiketten skrivs ut.
        </p>
      )}

      <div className="label-sheet">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="label">
            <div className="label-head">
              <span className="label-brand">SOCKERBAGAREN</span>
              <span className="label-sub">Recept 1957 · Södra Stockholm</span>
            </div>
            <div className="label-name">{product.name}</div>
            <div className="label-ingr">
              <strong>Ingredienser:</strong>{" "}
              {segments.map((s, j) => (s.allergen ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>))}
            </div>
            <div className="label-row">
              <span>
                <strong>Nettovikt:</strong> {netto}
              </span>
              <span>
                <strong>Bäst före:</strong> ____________
              </span>
            </div>
            <div className="label-row">
              <span>Förvaras torrt och svalt i stängd förpackning.</span>
              <span>Sats: ________</span>
            </div>
            <div className="label-foot">
              {invoiceConfig.companyName}, {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
