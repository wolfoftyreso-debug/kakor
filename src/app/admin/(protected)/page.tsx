import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatOre } from "@/lib/money";
import { formatDeliveryDate, todayInStockholm, capitalizeFirst, startOfStockholmDay, toISODate } from "@/lib/dates";
import { OrderStatusPill, PaymentStatusPill } from "@/components/admin/StatusPills";
import { foodVatNotice, FOOD_VAT_RATE_BP } from "@/lib/vat";
import { loadOpsDashboard } from "@/lib/warehouse/queries";
import { formatStockQty } from "@/lib/warehouse/inventory";
import { formatWeightKg } from "@/lib/units";
import { remainingOre, agingKey, addToAging, emptyAging } from "@/lib/invoice/aging";
import { DELIVERY_WEEK_STATUS_LABELS, isWeekLockedStatus, type DeliveryWeekStatus } from "@/lib/status";
import { areaBookingLine } from "@/components/admin/AreaBooking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin – översikt", robots: { index: false } };

export default async function AdminDashboard() {
  await requireAdminPage();
  const today = todayInStockholm();

  const [newOrders, activeSubscriptions, ordersToday, newOrderCount, productsAtTempVat, unpaidLedger] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: "NEW" },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.order.count({ where: { createdAt: { gte: startOfStockholmDay() } } }),
      prisma.order.count({ where: { status: "NEW" } }),
      prisma.product.count({ where: { active: true, vatRateBp: FOOD_VAT_RATE_BP } }),
      prisma.invoice.findMany({
        where: { status: "UNPAID", order: { status: { not: "CANCELLED" } } },
        include: {
          order: { select: { companyName: true, orgNumber: true } },
          creditNotes: { select: { totalOre: true } },
        },
      }),
    ]);
  const vatNotice = foodVatNotice(toISODate(today), productsAtTempVat);
  const ops = await loadOpsDashboard();
  const aging = emptyAging();
  const watch: { company: string; org: string; ore: number }[] = [];
  const watchMap = new Map<string, { company: string; org: string; ore: number }>();
  for (const i of unpaidLedger) {
    const ore = remainingOre(i.totalOre, i.creditNotes);
    const key = agingKey(i.dueDate, today);
    addToAging(aging, key, ore);
    if (key === "overdue" || key === "dueSoon") {
      const cur = watchMap.get(i.order.orgNumber) ?? { company: i.order.companyName, org: i.order.orgNumber, ore: 0 };
      cur.ore += ore;
      watchMap.set(i.order.orgNumber, cur);
    }
  }
  watch.push(...[...watchMap.values()].sort((a, b) => b.ore - a.ore));

  const stats = [
    { label: "Nya beställningar", value: String(newOrderCount), href: "/admin/bestallningar?filter=nya" },
    { label: "Beställningar i dag", value: String(ordersToday), href: "/admin/bestallningar" },
    {
      label: "Obetalda fakturor",
      value: `${aging.overdueCount + aging.dueSoonCount + aging.laterCount} · ${formatOre(aging.overdueOre + aging.dueSoonOre + aging.laterOre)}`,
      href: "/admin/fakturor?filter=obetalda",
    },
    {
      label: "Förfallet",
      value: `${aging.overdueCount} · ${formatOre(aging.overdueOre)}`,
      href: "/admin/fakturor?filter=forfallna",
    },
    {
      label: "Förfaller inom 7 dagar",
      value: `${aging.dueSoonCount} · ${formatOre(aging.dueSoonOre)}`,
      href: "/admin/fakturor?filter=forfaller-snart",
    },
    { label: "Aktiva prenumerationer", value: String(activeSubscriptions), href: "/admin/prenumerationer" },
  ];

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Att hantera</h1>
      {vatNotice && (
        <div
          role={vatNotice.urgent ? "alert" : "status"}
          className={vatNotice.urgent ? "error-text" : "info-box"}
          style={{ marginBottom: 20, padding: "10px 14px", fontSize: 14 }}
        >
          <strong>Momssats:</strong> {vatNotice.text}{" "}
          <Link href="/admin/produkter">Produkter →</Link>
        </div>
      )}
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

      <section className="card" style={{ padding: "20px 22px", marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 19, margin: 0 }}>Nästa leverans</h2>
          <Link href={ops.nextDay ? `/admin/leveranser/vecka/${ops.nextDay.weekParam}` : "/admin/leveranser"} style={{ fontWeight: 700, fontSize: 14 }}>
            Öppna veckan →
          </Link>
        </div>
        {ops.nextDay ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 16 }}>
              <div>
                <div className="section-label">Leveransdag</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700 }}>
                  {capitalizeFirst(formatDeliveryDate(ops.nextDay.deliveryDate))}
                </div>
              </div>
              <div>
                <div className="section-label">Leveranser</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700 }}>
                  {ops.nextDay.orderCount} · {formatWeightKg(ops.nextDay.totalGrams)}
                </div>
              </div>
              <div>
                <div className="section-label">Nästa cutoff</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ops.cutoffLabel ?? "–"}</div>
              </div>
              <div>
                <div className="section-label">Status</div>
                <span className={`pill ${isWeekLockedStatus(ops.nextDay.status) ? "pill-ok" : "pill-new"}`}>
                  {isWeekLockedStatus(ops.nextDay.status) ? "Låst" : DELIVERY_WEEK_STATUS_LABELS[ops.nextDay.status as DeliveryWeekStatus] ?? ops.nextDay.status}
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 20 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>Produktionsbehov</div>
                {ops.needs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)" }}>Inget beställt ännu.</p>
                ) : (
                  ops.needs.map((n) => (
                    <div key={`${n.productId}|${n.name}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
                      <span>{n.name}</span>
                      <strong style={{ color: n.needGrams > 0 ? "var(--red)" : undefined }}>
                        {n.needGrams > 0 ? `+${formatWeightKg(n.needGrams)}` : "0 kg"}
                      </strong>
                    </div>
                  ))
                )}
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>Lager</div>
                {ops.stock.map((s) => (
                  <div key={s.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0", gap: 10 }}>
                    <span>{s.name}</span>
                    <span>
                      {formatStockQty(s.physicalGrams, s.unit, s.packageWeightGrams)}
                      <span style={{ color: "var(--text-2)" }}>
                        {" "}
                        / {formatStockQty(s.reservedNextGrams, s.unit, s.packageWeightGrams)} till nästa
                        {s.reservedLaterGrams > 0
                          ? ` · ${formatStockQty(s.reservedLaterGrams, s.unit, s.packageWeightGrams)} senare`
                          : ""}
                      </span>
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <Link href="/admin/lager" style={{ fontWeight: 700, fontSize: 13 }}>
                    Öppna lagret →
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--text-2)" }}>
            Inga kommande leveranser inplanerade.{" "}
            <Link href="/admin/lager">Se lagret</Link>
          </p>
        )}
      </section>

      {ops.upcoming.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Bokade leveransdagar</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {ops.upcoming.map((d) => (
              <Link
                key={d.iso}
                href={`/admin/leveranser/vecka/${d.weekParam}`}
                className="card"
                style={{ padding: "14px 16px", textDecoration: "none", color: "var(--text)" }}
              >
                <div className="section-label">{d.weekLabel}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700, margin: "4px 0" }}>
                  {capitalizeFirst(formatDeliveryDate(d.deliveryDate))}
                </div>
                <div style={{ fontSize: 13.5 }}>
                  {d.orderCount} bokade · {formatWeightKg(d.totalGrams)}
                </div>
                {d.byArea.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>{areaBookingLine(d.byArea)}</div>
                )}
                <div style={{ marginTop: 8 }}>
                  <span className={`pill ${isWeekLockedStatus(d.status) ? "pill-ok" : "pill-new"}`}>
                    {isWeekLockedStatus(d.status) ? "Låst" : DELIVERY_WEEK_STATUS_LABELS[d.status as DeliveryWeekStatus] ?? d.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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
                    <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
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
              {newOrderCount > newOrders.length && (
                <Link href="/admin/bestallningar?filter=nya" style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>
                  Visa alla {newOrderCount} nya beställningar →
                </Link>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 19, marginBottom: 12 }}>Reskontra att bevaka</h2>
          {watch.length === 0 ? (
            <p style={{ color: "var(--text-2)", fontSize: 14 }}>Inget förfallet eller förfaller inom 7 dagar.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {watch.slice(0, 8).map((c) => (
                <Link
                  key={c.org}
                  href={`/admin/fakturor?filter=obetalda&q=${encodeURIComponent(c.company)}`}
                  className="card"
                  style={{ padding: "12px 16px", textDecoration: "none", color: "var(--text)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
                >
                  <div>
                    <strong>{c.company}</strong>
                    <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{c.org}</div>
                  </div>
                  <span style={{ fontWeight: 700 }}>{formatOre(c.ore)}</span>
                </Link>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/admin/fakturor" style={{ fontWeight: 700, fontSize: 14 }}>
              Öppna reskontran →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
