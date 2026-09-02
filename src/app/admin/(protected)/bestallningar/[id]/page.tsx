import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatOre } from "@/lib/money";
import { formatDate, formatDeliveryDate, capitalizeFirst, formatTimestamp } from "@/lib/dates";
import { priceSuffix, qtyLabel } from "@/lib/units";
import { isOrderOverdue } from "@/lib/status";
import {
  DeliveryStatusPill,
  OrderStatusPill,
  PaymentStatusPill,
} from "@/components/admin/StatusPills";
import { OrderActions } from "./OrderActions";
import { remainingByLine } from "@/lib/invoice/credit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — orderdetalj", robots: { index: false } };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      invoice: { include: { creditNotes: { orderBy: { createdAt: "asc" } } } },
      deliveryArea: true,
      subscription: true,
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();
  const creditNotes = order.invoice?.creditNotes ?? [];
  const creditedOre = creditNotes.reduce((s, c) => s + c.totalOre, 0); // negativt
  const creditLines = order.invoice
    ? remainingByLine(order.invoice.snapshotJson, creditNotes).map((r, i) => ({
        lineIndex: i,
        productName: r.line.productName,
        unit: r.line.unit ?? "kg",
        unitPriceOre: r.line.unitPricePerKgOre,
        remaining: r.remaining,
      }))
    : [];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26 }}>
          Order <span className="mono">{order.orderNumber}</span>
        </h1>
        <Link href="/admin/bestallningar" style={{ fontSize: 14, fontWeight: 600 }}>
          ← Alla beställningar
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <OrderStatusPill status={order.status} />
        <PaymentStatusPill
          status={order.paymentStatus}
          overdue={isOrderOverdue(order)}
        />
        <DeliveryStatusPill status={order.deliveryStatus} />
        {order.subscription && (
          <span className="pill pill-outline">
            Prenumeration {order.subscription.number}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 24 }}>
        <section className="card" style={{ padding: "20px 24px" }}>
          <div className="section-label" style={{ marginBottom: 12 }}>KAKOR</div>
          {order.items.map((i) => (
            <div key={i.id} className="divider-row" style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, padding: "8px 0" }}>
              <span style={{ fontWeight: 600 }}>{i.productName}</span>
              <span>
                {qtyLabel(i.weightKg, i.unit)} à {formatOre(i.unitPricePerKgOre)}
                {priceSuffix(i.unit)} = {formatOre(i.lineTotalOre)}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)", paddingTop: 10 }}>
            <span>Netto</span>
            <span>{formatOre(order.subtotalOre)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-2)" }}>
            <span>Moms</span>
            <span>{formatOre(order.vatOre)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, marginTop: 6 }}>
            <span>Totalt</span>
            <span>{formatOre(order.totalOre)}</span>
          </div>
        </section>

        <section className="card" style={{ padding: "20px 24px", fontSize: 14.5, lineHeight: 1.7 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>KUND</div>
          <strong>{order.companyName}</strong> · {order.orgNumber}
          <br />
          {order.contactName} · <a href={`mailto:${order.email}`}>{order.email}</a> ·{" "}
          {order.phone ? <a href={`tel:${order.phone}`}>{order.phone}</a> : "telefon saknas"}
          <div className="section-label" style={{ margin: "14px 0 6px" }}>LEVERANS</div>
          {order.deliveryAddress}, {order.deliveryPostalCode} {order.deliveryCity}
          {order.deliveryArea ? ` (${order.deliveryArea.name})` : ""}
          <br />
          {capitalizeFirst(formatDeliveryDate(order.deliveryDate))} ·
          leverans under dagen
          {order.deliveryInstruction && (
            <div style={{ background: "var(--butter-soft)", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 13.5 }}>
              {order.deliveryInstruction}
            </div>
          )}
          {order.deliveredAt && (
            <div style={{ marginTop: 8, fontSize: 13.5 }}>
              Levererad {formatTimestamp(order.deliveredAt)}
              {order.deliveryNote ? ` — ${order.deliveryNote}` : ""}
            </div>
          )}
          <div className="section-label" style={{ margin: "14px 0 6px" }}>FAKTURERING</div>
          Faktura-e-post: <a href={`mailto:${order.invoiceEmail}`}>{order.invoiceEmail}</a>
          {order.reference && (
            <>
              <br />
              Referens: {order.reference}
            </>
          )}
          {order.billingAddress && (
            <>
              <br />
              Fakturaadress: {order.billingAddress}
            </>
          )}
          {order.invoice && (
            <div style={{ marginTop: 8 }}>
              Faktura <span className="mono">{order.invoice.invoiceNumber}</span> ·{" "}
              {formatDate(order.invoice.invoiceDate)} · förfaller {formatDate(order.invoice.dueDate)} ·{" "}
              <a href={`/faktura/${order.invoice.downloadToken}`} target="_blank" rel="noopener">
                Öppna PDF
              </a>
              {order.invoice.status === "CREDITED" && (
                <>
                  {" "}
                  · <strong>Krediterad i sin helhet</strong>
                </>
              )}
              {creditNotes.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13.5 }}>
                  {creditNotes.map((c) => (
                    <div key={c.id}>
                      {c.kind === "FULL" ? "Kreditfaktura" : "Delkreditfaktura"}{" "}
                      <span className="mono">{c.creditNumber}</span> · {formatDate(c.issuedDate)} ·{" "}
                      {formatOre(-c.totalOre)} ·{" "}
                      <a href={`/faktura/${c.downloadToken}`} target="_blank" rel="noopener">
                        Öppna PDF
                      </a>
                    </div>
                  ))}
                  {order.invoice.status !== "CREDITED" && (
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      Återstår att betala: {formatOre(order.invoice.totalOre + creditedOre)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <OrderActions
        orderId={order.id}
        status={order.status}
        paymentStatus={order.paymentStatus}
        deliveryStatus={order.deliveryStatus}
        needsCreditNote={order.status === "CANCELLED" && !!order.invoice && order.invoice.status !== "CREDITED"}
        creditLines={order.status !== "CANCELLED" && order.invoice && order.invoice.status !== "CREDITED" ? creditLines : []}
      />

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 19, marginBottom: 12 }}>Historik</h2>
        <div className="card" style={{ padding: "8px 20px" }}>
          {order.events.map((e) => (
            <div key={e.id} className="divider-row" style={{ padding: "10px 0", fontSize: 13.5, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                {new Intl.DateTimeFormat("sv-SE", {
                  timeZone: "Europe/Stockholm",
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(e.createdAt)}
              </span>
              <span style={{ flex: 1 }}>{e.message}</span>
              <span style={{ color: "var(--text-2)", fontSize: 12 }}>{e.actor}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
