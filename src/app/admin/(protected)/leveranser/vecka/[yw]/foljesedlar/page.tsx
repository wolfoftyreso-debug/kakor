import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guard";
import { capitalizeFirst, formatDeliveryDateWithYear, fromISODate, parseIsoWeekParam } from "@/lib/dates";
import { qtyLabel } from "@/lib/units";
import { invoiceConfig } from "@/lib/config";
import { loadDayOps, loadWeekOps } from "@/lib/warehouse/queries";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin – leveranssedlar", robots: { index: false } };

export default async function AllSlipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ yw: string }>;
  searchParams: Promise<{ dag?: string }>;
}) {
  await requireAdminPage();
  const { yw } = await params;
  const { dag } = await searchParams;
  const parsed = parseIsoWeekParam(yw);
  if (!parsed) notFound();
  const days = dag ? [await loadDayOps(fromISODate(dag))] : await loadWeekOps(parsed.year, parsed.week);
  const stops = days.flatMap((d) => (d.snapshot?.stops ?? d.liveStops).map((s) => ({ ...s, date: d.deliveryDate })));

  return (
    <div className="print-sheet">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Link href={`/admin/leveranser/vecka/${yw}`} style={{ fontSize: 14, fontWeight: 600 }}>
          ← Tillbaka till veckan
        </Link>
        <PrintButton label="Skriv ut alla leveranssedlar" />
      </div>
      {stops.length === 0 && <p>Inga leveranser.</p>}
      {stops.map((stop, i) => {
        const totalKg = stop.items.filter((x) => x.unit !== "paket").reduce((s, x) => s + x.qty, 0);
        const totalPaket = stop.items.filter((x) => x.unit === "paket").reduce((s, x) => s + x.qty, 0);
        return (
          <article key={stop.orderId} className="slip-page" style={{ pageBreakAfter: i < stops.length - 1 ? "always" : "auto", paddingBottom: 24 }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, borderBottom: "2px solid var(--text)", paddingBottom: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 700 }}>Sockerbagaren</div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                  {invoiceConfig.companyName} · Org.nr {invoiceConfig.orgNumber}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2)" }}>Leveranssedel</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{stop.orderNumber}</div>
              </div>
            </header>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, fontSize: 14.5, lineHeight: 1.6 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 6 }}>LEVERERAS TILL</div>
                <strong>{stop.companyName}</strong>
                {stop.orgNumber ? <><br />Org.nr {stop.orgNumber}</> : null}
                <br />
                {stop.deliveryAddress}
                <br />
                {stop.deliveryPostalCode} {stop.deliveryCity}
                <br />
                {stop.contactName}
                {stop.phone ? ` · ${stop.phone}` : ""}
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 6 }}>LEVERANS</div>
                {capitalizeFirst(formatDeliveryDateWithYear(stop.date))}
                {stop.reference ? <><br />Er referens: {stop.reference}</> : null}
                {stop.subscriptionNumber ? <><br />Prenumeration {stop.subscriptionNumber}</> : null}
              </div>
            </div>
            {stop.deliveryInstruction && (
              <div style={{ border: "1px solid var(--text)", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 14 }}>
                <strong>Leveransanvisning:</strong> {stop.deliveryInstruction}
              </div>
            )}
            <table className="print-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, marginBottom: 20 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Sort</th>
                  <th style={{ textAlign: "right" }}>Mängd</th>
                  <th style={{ textAlign: "center", width: 90 }}>Packat</th>
                  <th style={{ textAlign: "center", width: 90 }}>Mottaget</th>
                </tr>
              </thead>
              <tbody>
                {stop.items.map((i) => (
                  <tr key={`${i.productName}|${i.unit}`}>
                    <td>{i.productName}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{qtyLabel(i.qty, i.unit)}</td>
                    <td style={{ textAlign: "center" }}>☐</td>
                    <td style={{ textAlign: "center" }}>☐</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>Totalt</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {[totalKg > 0 ? `${totalKg} kg` : null, totalPaket > 0 ? `${totalPaket} paket` : null].filter(Boolean).join(" + ")}
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, fontSize: 13 }}>
              <div>
                <div style={{ borderTop: "1px solid var(--text)", paddingTop: 6 }}>Packat av / datum</div>
              </div>
              <div>
                <div style={{ borderTop: "1px solid var(--text)", paddingTop: 6 }}>Mottaget av / datum</div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
