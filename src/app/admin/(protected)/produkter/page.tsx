import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatOre } from "@/lib/money";
import { priceSuffix } from "@/lib/units";
import { ProductActiveToggle } from "./ProductActiveToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — produkter", robots: { index: false } };

export default async function ProductsPage() {
  await requireAdminPage();
  const products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 26 }}>Produkter</h1>
        <Link href="/admin/produkter/ny" className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 14 }}>
          Ny produkt
        </Link>
      </div>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 20px", maxWidth: "70ch" }}>
        Prisändringar påverkar bara nya beställningar — historiska ordrar och fakturor behåller
        sina belopp.
      </p>

      <div className="table-wrap card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Pris</th>
              <th>Vikter</th>
              <th>Allergener</th>
              <th>Ordning</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/produkter/${p.id}`} style={{ fontWeight: 700 }}>
                    {p.name}
                  </Link>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>/{p.slug}</div>
                </td>
                <td style={{ fontWeight: 700 }}>
                  {formatOre(p.pricePerKgOre)}
                  {priceSuffix(p.unit)}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{p.weightOptionsJson}</td>
                <td style={{ fontSize: 12.5, maxWidth: 240 }}>{p.allergens}</td>
                <td>{p.sortOrder}</td>
                <td>
                  <span className={`pill ${p.active ? "pill-ok" : "pill-neutral"}`}>
                    {p.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td>
                  <ProductActiveToggle productId={p.id} active={p.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
