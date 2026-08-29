import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatOre } from "@/lib/money";
import { addDays, formatDeliveryDate, todayInStockholm } from "@/lib/dates";
import { OrderStatusPill, PaymentStatusPill } from "@/components/admin/StatusPills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — översikt", robots: { index: false } };

export default async function AdminDashboard() {
  const today = todayInStockholm();
  const weekAhead = addDays(today, 7);

  const [newOrders, upcomingDeliveries, unpaidInvoices, overdueInvoices, activeSubscriptions, ordersToday] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: "NEW" },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.order.findMany({
        where: {
          status: { not: "CANCELLED" },
          deliveryStatus: "PENDING",
          deliveryDate: { gte: today, lte: weekAhead },
        },
        orderBy: { deliveryDate: "asc" },
        take: 8,
        include: { deliveryArea: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "UNPAID", order: { status: { not: "CANCELLED" } } },
        _count: true,
        _sum: { totalOre: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "UNPAID", dueDate: { lt: today }, order: { status: { not: "CANCELLED" } } },
        _count: true,
        _sum: { totalOre: true },
      }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
    ]);

  const stats = [
    { label: "Nya beställningar", value: String(newOrders.length), href: "/admin/bestallningar?filter=nya" },
    { label: "Beställningar idag", value: String(ordersToday), href: "/admin/bestallningar" },
    {
      label: "Obetalda fakturor",
      value: `${unpaidInvoices._count} · ${formatOre(unpaidInvoices._sum.totalOre ?? 0)}`,
      href: "/admin/fakturor?filter=obetalda",
    },
    {
      label: "Förfallna fakturor",
      value: `${overdueInvoices._count} · ${formatOre(overdueInvoices._sum.totalOre ?? 0)}`,
      href: "/admin/fakturor?filter=forfallna",
    },
    { label: "Aktiva prenumerationer", value: String(activeSubscriptions), href: "/admin/prenumerationer" },
  ];

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Att hantera</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 36,
        }}
      >
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card"
            style={{ padding: "16px 18px", textDecoration: "none", color: "var(--text)" }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "var(--text-2)", textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {s.value}
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        <section>
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Nya beställningar</h2>
          {newOrders.length === 0 ? (
            <p style={{ color: "var(--text-2)", fontSize: 14 }}>Inga nya beställningar just nu.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {newOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/bestallningar/${o.id}`}
                  className="card"
                  style={{ padding: "12px 16px", textDecoration: "none", color: "var(--text)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}
                >
                  <div>
                    <span className="mono" style={{ fontSize: 12 }}>{o.orderNumber}</span>{" "}
                    <strong>{o.companyName}</strong>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", textTransform: "capitalize" }}>
                      Leverans {formatDeliveryDate(o.deliveryDate)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{formatOre(o.totalOre)}</span>
                    <OrderStatusPill status={o.status} />
                    <PaymentStatusPill status={o.paymentStatus} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Kommande leveranser (7 dagar)</h2>
          {upcomingDeliveries.length === 0 ? (
            <p style={{ color: "var(--text-2)", fontSize: 14 }}>Inga leveranser inplanerade.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingDeliveries.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/bestallningar/${o.id}`}
                  className="card"
                  style={{ padding: "12px 16px", textDecoration: "none", color: "var(--text)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
                >
                  <div>
                    <strong style={{ textTransform: "capitalize" }}>{formatDeliveryDate(o.deliveryDate)}</strong>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                      {o.companyName} · {o.deliveryArea?.name ?? o.deliveryCity}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 12, alignSelf: "center" }}>{o.orderNumber}</span>
                </Link>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/admin/leveranser" style={{ fontWeight: 700, fontSize: 14 }}>
              Öppna leveransvyn →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
