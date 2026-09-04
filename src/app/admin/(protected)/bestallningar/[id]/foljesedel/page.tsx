import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { capitalizeFirst, formatDeliveryDateWithYear, toISODate } from "@/lib/dates";
import { qtyLabel } from "@/lib/units";
import { invoiceConfig } from "@/lib/config";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — följesedel", robots: { index: false } };

// Följesedel: läggs i kartongen. Inga priser — mottagaren på kontoret ska
// bara kunna pricka av att rätt sorter och mängder kom fram.
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, deliveryArea: true, invoice: true },
  });
  if (!order) notFound();
  const totalKg = order.items.filter((i) => i.unit !== "paket").reduce((s, i) => s + i.weightKg, 0);
  const totalPaket = order.items.filter((i) => i.unit === "paket").reduce((s, i) => s + i.weightKg, 0);

  return (
    <div className="print-sheet">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Link href={`/admin/bestallningar/${order.id}`} style={{ fontSize: 14, fontWeight: 600 }}>
          ← Tillbaka till ordern
        </Link>
        <PrintButton label="Skriv ut följesedel" />
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, borderBottom: "2px solid var(--text)", paddingBottom: 14, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 700 }}>Sockerbagaren</div>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            {invoiceConfig.companyName} · Org.nr {invoiceConfig.orgNumber}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2)" }}>Följesedel</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{order.orderNumber}</div>
          {order.invoice && (
            <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>Faktura {order.invoice.invoiceNumber}</div>
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, fontSize: 14.5, lineHeight: 1.6 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>LEVERERAS TILL</div>
          <strong>{order.companyName}</strong>
          <br />
          {order.deliveryAddress}
          <br />
          {order.deliveryPostalCode} {order.deliveryCity}
          <br />
          {order.contactName}
          {order.phone ? ` · ${order.phone}` : ""}
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>LEVERANS</div>
          {capitalizeFirst(formatDeliveryDateWithYear(order.deliveryDate))}
          {order.deliveryArea ? <><br />{order.deliveryArea.name}</> : null}
          {order.reference ? <><br />Er referens: {order.reference}</> : null}
        </div>
      </div>

      {order.deliveryInstruction && (
        <div style={{ border: "1px solid var(--text)", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 14 }}>
          <strong>Leveransanvisning:</strong> {order.deliveryInstruction}
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
          {order.items.map((i) => (
            <tr key={i.id}>
              <td>{i.productName}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{qtyLabel(i.weightKg, i.unit)}</td>
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

      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 28px" }}>
        Förvara torrt och svalt i stängd förpackning. Fakturan skickas separat till {order.invoiceEmail}
        {order.invoice ? `, förfallodatum ${toISODate(order.invoice.dueDate)}` : ""}. Saknas något? Svara på orderbekräftelsen.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, fontSize: 13 }}>
        <div>
          <div style={{ borderTop: "1px solid var(--text)", paddingTop: 6 }}>Packat av / datum</div>
        </div>
        <div>
          <div style={{ borderTop: "1px solid var(--text)", paddingTop: 6 }}>Mottaget av / datum</div>
        </div>
      </div>
    </div>
  );
}
