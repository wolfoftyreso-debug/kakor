import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatTimestamp } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatStockQty, formatSignedGrams, loadStock } from "@/lib/warehouse/inventory";
import { AdjustForm, MinLevelForm } from "./AdjustForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin – lager", robots: { index: false } };

export default async function LagerPage() {
  await requireAdminPage();
  const [stock, movements] = await Promise.all([
    loadStock(),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { product: { select: { name: true, unit: true, packageWeightGrams: true } } },
    }),
  ]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Lager</h1>
        <Link href="/admin/leveranser" style={{ fontSize: 14, fontWeight: 600 }}>
          Till leveranser →
        </Link>
      </div>
      <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 20px", maxWidth: "72ch" }}>
        Fysiskt lager är det som ligger i frysen. Reserverat är beställt men inte plockat.
        Disponibelt = fysiskt minus reserverat. Alla justeringar loggas.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stock.map((s) => {
          const deficit = s.availableGrams < 0;
          const negativePhysical = s.physicalGrams < 0;
          const low = s.minGrams > 0 && s.physicalGrams < s.minGrams;
          return (
            <article key={s.productId} className="card" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <div>
                  <h2 style={{ fontSize: 20, margin: 0, fontFamily: "var(--font-serif)" }}>{s.name}</h2>
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                    SKU {s.slug}
                    {!s.active ? " · utgången sort" : ""}
                  </div>
                </div>
                {(deficit || low || negativePhysical) && (
                  <span className="pill pill-warn">{negativePhysical ? "Negativt fysiskt saldo" : deficit ? "Underskott" : "Under miniminivå"}</span>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <Stat label="Fysiskt" value={formatStockQty(s.physicalGrams, s.unit, s.packageWeightGrams)} warn={negativePhysical} />
                <Stat label="Reserverat" value={formatStockQty(s.reservedGrams, s.unit, s.packageWeightGrams)} />
                <Stat
                  label="Disponibelt"
                  value={formatStockQty(s.availableGrams, s.unit, s.packageWeightGrams)}
                  warn={deficit}
                />
                <Stat
                  label="Miniminivå"
                  value={s.minGrams > 0 ? formatStockQty(s.minGrams, s.unit, s.packageWeightGrams) : "–"}
                />
              </div>
              {s.lastAdjustment && (
                <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "12px 0 0" }}>
                  Senaste justering: {s.lastAdjustment.reason} · {s.lastAdjustment.actor} ·{" "}
                  {formatTimestamp(s.lastAdjustment.at)} ·{" "}
                  {formatSignedGrams(s.lastAdjustment.gramsDelta, s.unit, s.packageWeightGrams)}
                </p>
              )}
              <AdjustForm productId={s.productId} productName={s.name} unit={s.unit} />
              <MinLevelForm productId={s.productId} minKg={s.minGrams / 1000} />
            </article>
          );
        })}
      </div>

      <h2 style={{ fontSize: 19, margin: "32px 0 12px" }}>Lagerhistorik</h2>
      {movements.length === 0 ? (
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>Inga rörelser ännu.</p>
      ) : (
        <div className="card" style={{ padding: "4px 0" }}>
          {movements.map((m) => (
            <div
              key={m.id}
              className="divider-row"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 16px", fontSize: 13.5 }}
            >
              <div>
                <strong>{m.product.name}</strong> · {m.reason}
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {formatTimestamp(m.createdAt)} · {m.actor}
                  {m.orderId ? " · kopplad order" : ""}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: m.gramsDelta < 0 ? "var(--red)" : undefined }}>
                {formatSignedGrams(m.gramsDelta, m.product.unit, m.product.packageWeightGrams)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700, color: warn ? "var(--red)" : undefined }}>
        {value}
      </div>
    </div>
  );
}
