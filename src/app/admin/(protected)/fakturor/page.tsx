import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { formatOre } from "@/lib/money";
import { addDays, formatDate, todayInStockholm } from "@/lib/dates";
import { isInvoiceOverdue } from "@/lib/status";
import { addToAging, agingKey, emptyAging, remainingOre } from "@/lib/invoice/aging";
import { PaymentStatusPill } from "@/components/admin/StatusPills";
import { MarkInvoicePaidButton } from "./MarkInvoicePaidButton";
import { SendReminderButton } from "./SendReminderButton";
import { ExportForm } from "./ExportForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin – reskontra", robots: { index: false } };

const FILTERS = [
  { key: "alla", label: "Alla" },
  { key: "obetalda", label: "Obetalda" },
  { key: "forfallna", label: "Förfallna" },
  { key: "forfaller-snart", label: "Förfaller inom 7 dagar" },
  { key: "betalda", label: "Betalda" },
  { key: "krediterade", label: "Krediterade" },
];

const PAGE_SIZE = 50;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sida?: string; q?: string }>;
}) {
  await requireAdminPage();
  const { filter = "alla", sida = "1", q = "" } = await searchParams;
  const page = Math.max(1, parseInt(sida, 10) || 1);
  const today = todayInStockholm();
  const soon = addDays(today, 7);

  const where: Prisma.InvoiceWhereInput = {};
  switch (filter) {
    case "obetalda":
      where.status = "UNPAID";
      where.order = { status: { not: "CANCELLED" } };
      break;
    case "forfallna":
      where.status = "UNPAID";
      where.dueDate = { lt: today };
      where.order = { status: { not: "CANCELLED" } };
      break;
    case "forfaller-snart":
      where.status = "UNPAID";
      where.dueDate = { gte: today, lte: soon };
      where.order = { status: { not: "CANCELLED" } };
      break;
    case "betalda":
      where.status = "PAID";
      break;
    case "krediterade":
      where.status = "CREDITED";
      break;
  }
  if (q.trim()) {
    const term = q.trim();
    where.OR = [
      { invoiceNumber: { contains: term } },
      { order: { companyName: { contains: term } } },
      { order: { orgNumber: { contains: term } } },
      { order: { orderNumber: { contains: term } } },
    ];
  }

  const [invoices, totalCount, unpaidRows] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: filter === "forfallna" || filter === "obetalda" || filter === "forfaller-snart" ? { dueDate: "asc" } : { invoiceDate: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { order: true, creditNotes: true },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where: { status: "UNPAID", order: { status: { not: "CANCELLED" } } },
      include: {
        order: { select: { companyName: true, orgNumber: true } },
        creditNotes: { select: { totalOre: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const owed = (i: { totalOre: number; creditNotes: { totalOre: number }[] }) => remainingOre(i.totalOre, i.creditNotes);

  const aging = emptyAging();
  const byCustomer = new Map<string, { company: string; org: string; ore: number; overdue: number }>();
  for (const i of unpaidRows) {
    const ore = owed(i);
    const key = agingKey(i.dueDate, today);
    addToAging(aging, key, ore);
    const org = i.order.orgNumber;
    const cur = byCustomer.get(org) ?? { company: i.order.companyName, org, ore: 0, overdue: 0 };
    cur.ore += ore;
    if (key === "overdue") cur.overdue += 1;
    byCustomer.set(org, cur);
  }
  const customers = [...byCustomer.values()].sort((a, b) => b.overdue - a.overdue || b.ore - a.ore);
  const outstanding = aging.overdueOre + aging.dueSoonOre + aging.laterOre;

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Reskontra</h1>
      <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 16px" }}>
        Kundfordringar mot faktura, 30 dagar från leverans. Obetalt totalt: <strong>{formatOre(outstanding)}</strong>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <AgingCard
          href="/admin/fakturor?filter=forfallna"
          label="Förfallet"
          count={aging.overdueCount}
          ore={aging.overdueOre}
          warn
        />
        <AgingCard
          href="/admin/fakturor?filter=forfaller-snart"
          label="Förfaller inom 7 dagar"
          count={aging.dueSoonCount}
          ore={aging.dueSoonOre}
        />
        <AgingCard
          href="/admin/fakturor?filter=obetalda"
          label="Övrigt obetalt"
          count={aging.laterCount}
          ore={aging.laterOre}
        />
      </div>

      {customers.length > 0 && (
        <section className="card" style={{ padding: "14px 18px", marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Kundreskontra – obetalt per företag</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {customers.map((c) => (
              <div key={c.org} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, flexWrap: "wrap" }}>
                <span>
                  <Link href={`/admin/fakturor?filter=obetalda&q=${encodeURIComponent(c.company)}`} style={{ fontWeight: 700 }}>
                    {c.company}
                  </Link>
                  <span style={{ color: "var(--text-2)", marginLeft: 8 }} className="mono">
                    {c.org}
                  </span>
                  {c.overdue > 0 && (
                    <span className="pill pill-warn" style={{ marginLeft: 8 }}>
                      {c.overdue} förfallen{c.overdue === 1 ? "" : "a"}
                    </span>
                  )}
                </span>
                <strong>{formatOre(c.ore)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <ExportForm />

      <form method="get" action="/admin/fakturor" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input type="hidden" name="filter" value={filter} />
        <label className="field" style={{ flex: "1 1 220px", margin: 0 }}>
          <span className="visually-hidden">Sök faktura</span>
          <input type="search" name="q" defaultValue={q} placeholder="Företag, org.nr, faktura- eller ordernummer" />
        </label>
        <button type="submit" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
          Sök
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/fakturor?filter=${f.key}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`}
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
                <th scope="col">Faktura</th>
                <th scope="col">Order</th>
                <th scope="col">Kund</th>
                <th scope="col">Fakturadatum</th>
                <th scope="col">Förfaller</th>
                <th scope="col">Belopp</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="visually-hidden">Åtgärder</span></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const overdue = inv.order.status !== "CANCELLED" && isInvoiceOverdue(inv);
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
                      <div style={{ fontSize: 12 }}>
                        <a href={`/faktura/${inv.downloadToken}?download=1`}>Spara PDF</a>
                      </div>
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
                    <td style={{ fontWeight: 700 }}>
                      {formatOre(inv.totalOre)}
                      {inv.creditNotes.length > 0 && inv.status !== "CREDITED" && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                          att betala {formatOre(owed(inv))}
                        </div>
                      )}
                    </td>
                    <td>
                      {inv.status === "CREDITED" ? (
                        <span className="pill pill-neutral">Krediterad</span>
                      ) : (
                        <PaymentStatusPill status={inv.status} overdue={overdue} />
                      )}
                      {inv.creditNotes.map((c) => (
                        <a
                          key={c.id}
                          href={`/faktura/${c.downloadToken}`}
                          target="_blank"
                          rel="noopener"
                          className="mono"
                          style={{ marginLeft: 6, fontSize: 12 }}
                        >
                          {c.kind === "FULL" ? "Kredit" : "Delkredit"} {c.creditNumber}
                        </a>
                      ))}
                      {inv.order.status === "CANCELLED" && inv.status !== "CREDITED" && (
                        <span className="pill pill-neutral" style={{ marginLeft: 6 }}>
                          Order avbruten
                        </span>
                      )}
                    </td>
                    <td>
                      {inv.status === "UNPAID" && inv.order.status !== "CANCELLED" && (
                        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                          <MarkInvoicePaidButton orderId={inv.orderId} />
                          {overdue && <SendReminderButton orderId={inv.orderId} />}
                        </span>
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
            <Link href={`/admin/fakturor?filter=${filter}&sida=${page - 1}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
              ← Föregående
            </Link>
          )}
          <span style={{ color: "var(--text-2)" }}>
            Sida {page} av {totalPages} ({totalCount} fakturor)
          </span>
          {page < totalPages && (
            <Link href={`/admin/fakturor?filter=${filter}&sida=${page + 1}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
              Nästa →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function AgingCard({ href, label, count, ore, warn }: { href: string; label: string; count: number; ore: number; warn?: boolean }) {
  return (
    <Link href={href} className="card" style={{ padding: "14px 16px", textDecoration: "none", color: "var(--text)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: warn && count > 0 ? "var(--red)" : "var(--text-2)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, marginTop: 4, color: warn && count > 0 ? "var(--red)" : undefined }}>
        {count} · {formatOre(ore)}
      </div>
    </Link>
  );
}
