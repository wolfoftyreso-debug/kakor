import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { formatOre } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { todayInStockholm } from "@/lib/dates";
import { isOrderOverdue } from "@/lib/status";
import {
  DeliveryStatusPill,
  OrderStatusPill,
  PaymentStatusPill,
} from "@/components/admin/StatusPills";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — beställningar", robots: { index: false } };

const FILTERS: { key: string; label: string }[] = [
  { key: "alla", label: "Alla" },
  { key: "nya", label: "Nya" },
  { key: "obetalda", label: "Obetalda" },
  { key: "betalda", label: "Betalda" },
  { key: "kommande", label: "Kommande leveranser" },
  { key: "levererade", label: "Levererade" },
  { key: "avbrutna", label: "Avbrutna" },
];

const PAGE_SIZE = 50;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; sida?: string }>;
}) {
  await requireAdminPage();
  const { filter = "alla", q = "", sida = "1" } = await searchParams;
  const page = Math.max(1, parseInt(sida, 10) || 1);

  const where: Prisma.OrderWhereInput = {};
  switch (filter) {
    case "nya":
      where.status = "NEW";
      break;
    case "obetalda":
      where.paymentStatus = "UNPAID";
      where.status = { not: "CANCELLED" };
      break;
    case "betalda":
      where.paymentStatus = "PAID";
      break;
    case "kommande":
      where.deliveryStatus = "PENDING";
      where.status = { not: "CANCELLED" };
      where.deliveryDate = { gte: todayInStockholm() };
      break;
    case "levererade":
      where.deliveryStatus = "DELIVERED";
      break;
    case "avbrutna":
      where.status = "CANCELLED";
      break;
  }
  if (q.trim()) {
    const term = q.trim();
    where.OR = [
      { orderNumber: { contains: term } },
      { companyName: { contains: term } },
      { orgNumber: { contains: term } },
      { email: { contains: term } },
      { invoiceEmail: { contains: term } },
      { invoice: { invoiceNumber: { contains: term } } },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { deliveryArea: true, invoice: true },
    }),
    prisma.order.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageUrl = (p: number) =>
    `/admin/bestallningar?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}&sida=${p}`;

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Beställningar</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/bestallningar?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={filter === f.key ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 20, maxWidth: 480 }}>
        <input type="hidden" name="filter" value={filter} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Sök ordernummer, företag, org.nr, e-post, fakturanummer"
          style={{
            flex: 1,
            border: "1.5px solid var(--input-border)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 14,
            background: "var(--surface)",
          }}
        />
        <button type="submit" className="btn btn-outline" style={{ padding: "8px 16px" }}>
          Sök
        </button>
      </form>

      {orders.length === 0 ? (
        <p style={{ color: "var(--text-2)" }}>Inga beställningar matchar.</p>
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Kund</th>
                <th>Datum</th>
                <th>Leveransdatum</th>
                <th>Belopp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/bestallningar/${o.id}`} className="mono" style={{ fontWeight: 700, fontSize: 13 }}>
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>
                    <strong>{o.companyName}</strong>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {o.orgNumber} · {o.deliveryArea?.name ?? o.deliveryCity}
                    </div>
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{formatDate(o.deliveryDate)}</td>
                  <td style={{ fontWeight: 700 }}>{formatOre(o.totalOre)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <OrderStatusPill status={o.status} />
                      <PaymentStatusPill
                        status={o.paymentStatus}
                        overdue={isOrderOverdue(o)}
                      />
                      <DeliveryStatusPill status={o.deliveryStatus} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, fontSize: 14 }}>
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
              ← Föregående
            </Link>
          )}
          <span style={{ color: "var(--text-2)" }}>
            Sida {page} av {totalPages} ({totalCount} beställningar)
          </span>
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
              Nästa →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
