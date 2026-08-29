import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { formatOre } from "@/lib/money";
import { formatDate, todayInStockholm } from "@/lib/dates";
import { isInvoiceOverdue } from "@/lib/status";
import { PaymentStatusPill } from "@/components/admin/StatusPills";
import { MarkInvoicePaidButton } from "./MarkInvoicePaidButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — fakturor", robots: { index: false } };

const FILTERS = [
  { key: "alla", label: "Alla" },
  { key: "obetalda", label: "Obetalda" },
  { key: "forfallna", label: "Förfallna" },
  { key: "betalda", label: "Betalda" },
];

const PAGE_SIZE = 50;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sida?: string }>;
}) {
  const { filter = "alla", sida = "1" } = await searchParams;
  const page = Math.max(1, parseInt(sida, 10) || 1);
  const today = todayInStockholm();

  const where: Prisma.InvoiceWhereInput = {};
  switch (filter) {
    case "obetalda":
      where.status = "UNPAID";
      where.order = { status: { not: "CANCELLED" } };
      break;
    case "forfallna":
      // OVERDUE lagras aldrig — härleds ur förfallodatum + status.
      where.status = "UNPAID";
      where.dueDate = { lt: today };
      where.order = { status: { not: "CANCELLED" } };
      break;
    case "betalda":
      where.status = "PAID";
      break;
  }

  const [invoices, totalCount] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { order: true },
    }),
    prisma.invoice.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const unpaidSum = invoices
    .filter((i) => i.status === "UNPAID" && i.order.status !== "CANCELLED")
    .reduce((s, i) => s + i.totalOre, 0);

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Fakturor</h1>
      <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 20px" }}>
        Enkel reskontra — obetalt i listan: <strong>{formatOre(unpaidSum)}</strong>
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/fakturor?filter=${f.key}`}
            className={filter === f.key ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <p style={{ color: "var(--text-2)" }}>Inga fakturor matchar.</p>
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faktura</th>
                <th>Order</th>
                <th>Kund</th>
                <th>Fakturadatum</th>
                <th>Förfaller</th>
                <th>Belopp</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const overdue = isInvoiceOverdue(inv);
                return (
                  <tr key={inv.id}>
                    <td>
                      <a
                        href={`/faktura/${inv.downloadToken}`}
                        target="_blank"
                        rel="noopener"
                        className="mono"
                        style={{ fontWeight: 700, fontSize: 13 }}
                      >
                        {inv.invoiceNumber}
                      </a>
                    </td>
                    <td>
                      <Link href={`/admin/bestallningar/${inv.orderId}`} className="mono" style={{ fontSize: 13 }}>
                        {inv.order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      <strong>{inv.order.companyName}</strong>
                      <div style={{ fontSize: 12, color: "var(--text-2)" }}>{inv.order.orgNumber}</div>
                    </td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td style={overdue ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                      {formatDate(inv.dueDate)}
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatOre(inv.totalOre)}</td>
                    <td>
                      <PaymentStatusPill status={inv.status} overdue={overdue} />
                      {inv.order.status === "CANCELLED" && (
                        <span className="pill pill-neutral" style={{ marginLeft: 6 }}>
                          Order avbruten
                        </span>
                      )}
                    </td>
                    <td>
                      {inv.status === "UNPAID" && inv.order.status !== "CANCELLED" && (
                        <MarkInvoicePaidButton orderId={inv.orderId} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, fontSize: 14 }}>
          {page > 1 && (
            <Link href={`/admin/fakturor?filter=${filter}&sida=${page - 1}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
              ← Föregående
            </Link>
          )}
          <span style={{ color: "var(--text-2)" }}>
            Sida {page} av {totalPages} ({totalCount} fakturor)
          </span>
          {page < totalPages && (
            <Link href={`/admin/fakturor?filter=${filter}&sida=${page + 1}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
              Nästa →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
