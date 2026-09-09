import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDeliveryDate, toISODate, todayInStockholm, capitalizeFirst } from "@/lib/dates";
import { qtyLabel, formatWeightKg } from "@/lib/units";
import { MarkDeliveredInline } from "./MarkDeliveredInline";
import { PickButtons } from "./PickButtons";
import { RunLockButton } from "./RunLockButton";
import { PrintButton } from "@/components/admin/PrintButton";
import { totalKg as orderKg } from "@/lib/orders/capacity";
import { listUpcomingDayOps } from "@/lib/warehouse/queries";
import { DELIVERY_WEEK_STATUS_LABELS, isWeekLockedStatus, type DeliveryWeekStatus } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin – leveranser", robots: { index: false } };

// Leveransvyn: verksamhetens arbetsverktyg under leveransdagen.
// Grupperad per datum, byggd för mobil.
export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ visa?: string; klar?: string }>;
}) {
  await requireAdminPage();
  const { visa = "kommande", klar } = await searchParams;
  const today = todayInStockholm();
  const upcomingWeeks = visa === "levererade" ? [] : await listUpcomingDayOps();

  const orders = await prisma.order.findMany({
    where:
      visa === "levererade"
        ? { deliveryStatus: "DELIVERED", status: { not: "CANCELLED" } }
        : {
            // Alla olevererade – även äldre än en vecka, annars försvinner
            // glömda ordrar ur den enda vy verksamheten packar från.
            deliveryStatus: "PENDING",
            status: { not: "CANCELLED" },
          },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
    take: 300,
    include: { items: { include: { product: { select: { packageWeightGrams: true } } } }, deliveryArea: true },
  });

  const groups = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = toISODate(o.deliveryDate);
    const arr = groups.get(key) ?? [];
    arr.push(o);
    groups.set(key, arr);
  }
  const sortedKeys =
    visa === "levererade" ? [...groups.keys()].sort().reverse() : [...groups.keys()].sort();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 26 }}>Leveranser</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {visa !== "levererade" && sortedKeys.length > 0 && <PrintButton label="Skriv ut körlista" />}
          <RunLockButton />
          <Link href="/admin/lager" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
            Lager
          </Link>
          <Link href="/admin/leveranser/historik" className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
            Historik
          </Link>
          <Link
            href="/admin/leveranser"
            className={visa !== "levererade" ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            Kommande
          </Link>
          <Link
            href="/admin/leveranser?visa=levererade"
            className={visa === "levererade" ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            Levererade
          </Link>
        </div>
      </div>

      {upcomingWeeks.length > 0 && (
        <section className="no-print" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Leveransveckor</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {upcomingWeeks.map((d) => (
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
                  {d.orderCount} leveranser · {formatWeightKg(d.totalGrams)}
                </div>
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

      {klar && (
        <div role="status" className="info-box" style={{ marginBottom: 16, fontSize: 14 }}>
          {klar} är markerad som levererad – kunden har fått leveransbekräftelse.
        </div>
      )}
      {sortedKeys.length === 0 && (
        <p style={{ color: "var(--text-2)" }}>
          {visa === "levererade" ? "Inga levererade ordrar ännu." : "Inga kommande leveranser."}
        </p>
      )}

      {sortedKeys.map((dateKey, dayIndex) => {
        const dayOrders = groups.get(dateKey)!;
        // Lösvikt och paket summeras separat – "12 kg + 2 paket" är packlistans sanning.
        const allItems = dayOrders.flatMap((o) => o.items);
        const totalKg = allItems.filter((i) => i.unit !== "paket").reduce((s, i) => s + i.weightKg, 0);
        const totalPaket = allItems.filter((i) => i.unit === "paket").reduce((s, i) => s + i.weightKg, 0);
        const dayTotal = [
          totalKg > 0 ? `${totalKg} kg` : null,
          totalPaket > 0 ? `${totalPaket} paket` : null,
        ]
          .filter(Boolean)
          .join(" + ") || "0 kg";
        // Bakplan: hur mycket av varje sort dagen kräver – det är vad som ska
        // finnas i lager/bakas i sats, inte "12 kg totalt".
        const perProduct = new Map<string, { name: string; unit: string; qty: number; orders: number }>();
        for (const o of dayOrders) {
          for (const i of o.items) {
            const key = `${i.productName}|${i.unit}`;
            const cur = perProduct.get(key) ?? { name: i.productName, unit: i.unit, qty: 0, orders: 0 };
            cur.qty += i.weightKg;
            cur.orders += 1;
            perProduct.set(key, cur);
          }
        }
        const bakplan = [...perProduct.values()].sort((a, b) => b.qty - a.qty);
        // Kapacitet per område den här dagen: "Tyresö 18 av 30 kg".
        const byArea = new Map<string, { name: string; kg: number; max: number }>();
        for (const o of dayOrders) {
          if (!o.deliveryArea) continue;
          const cur = byArea.get(o.deliveryArea.id) ?? { name: o.deliveryArea.name, kg: 0, max: o.deliveryArea.maxKgPerDay };
          cur.kg += orderKg(o.items.map((i) => ({ weightKg: i.weightKg, unit: i.unit, packageWeightGrams: i.product?.packageWeightGrams })));
          byArea.set(o.deliveryArea.id, cur);
        }
        const capacityNote = [...byArea.values()]
          .filter((a) => a.max > 0)
          .map((a) => `${a.name} ${Math.round(a.kg * 10) / 10} av ${a.max} kg${a.kg >= a.max ? " – FULLT" : ""}`)
          .join(" · ");
        return (
          <section key={dateKey} style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 20,
                marginBottom: 4,
                borderBottom: "2px solid var(--text)",
                paddingBottom: 8,
                color: visa !== "levererade" && dateKey < toISODate(today) ? "var(--red)" : undefined,
              }}
            >
              {capitalizeFirst(formatDeliveryDate(dayOrders[0].deliveryDate))} {dateKey.slice(0, 4)}
              {visa !== "levererade" && dateKey < toISODate(today) ? " – FÖRSENAD, ej markerad levererad" : ""}
            </h2>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
              {dayOrders.length} leverans{dayOrders.length === 1 ? "" : "er"} · {dayTotal} totalt
            </div>
            {/* De två närmaste dagarna är öppna; resten hopfällda så att sidan inte blir kilometerlång. */}
            <details open={dayIndex < 2 || undefined} className="day-details">
              <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
                {dayIndex < 2 ? "Dölj" : "Visa"} dagens {dayOrders.length} leverans{dayOrders.length === 1 ? "" : "er"}
              </summary>
            {visa !== "levererade" && bakplan.length > 0 && (
              <div className="card bakplan" style={{ padding: "12px 18px", marginBottom: 14, background: "var(--butter-soft)" }}>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  BAKPLAN – PER SORT
                  {capacityNote ? <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", marginLeft: 10 }}>{capacityNote}</span> : null}
                </div>
                <div style={{ display: "flex", gap: "6px 22px", flexWrap: "wrap", fontSize: 14 }}>
                  {bakplan.map((b) => (
                    <span key={`${b.name}|${b.unit}`}>
                      <strong>{qtyLabel(b.qty, b.unit)}</strong> {b.name}{" "}
                      <span style={{ color: "var(--text-2)", fontSize: 12.5 }}>({b.orders} {b.orders === 1 ? "order" : "ordrar"})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {dayOrders.map((o) => (
                <div key={o.id} className="card" style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 16 }}>{o.companyName}</strong>{" "}
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                        {o.orderNumber}
                      </span>
                      <div style={{ fontSize: 13.5, marginTop: 2 }}>
                        {o.deliveryAddress}, {o.deliveryPostalCode} {o.deliveryCity}
                        {o.deliveryArea ? ` · ${o.deliveryArea.name}` : ""}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                        {o.contactName}
                        {o.phone ? <> · <a href={`tel:${o.phone}`}>{o.phone}</a></> : null}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, textAlign: "right", minWidth: 140 }}>
                      {o.items.map((i) => (
                        <div key={i.id}>
                          <strong>{qtyLabel(i.weightKg, i.unit)}</strong> {i.productName}
                        </div>
                      ))}
                    </div>
                  </div>
                  {o.deliveryInstruction && (
                    <div className="info-box" style={{ marginTop: 10, fontSize: 13.5 }}>
                      {o.deliveryInstruction}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <Link
                      href={`/admin/bestallningar/${o.id}`}
                      className="btn btn-outline"
                      style={{ padding: "9px 16px", fontSize: 13 }}
                    >
                      Öppna beställning
                    </Link>
                    <Link
                      href={`/admin/bestallningar/${o.id}/foljesedel`}
                      className="btn btn-outline"
                      style={{ padding: "9px 16px", fontSize: 13 }}
                    >
                      Följesedel
                    </Link>
                    {o.deliveryStatus === "PENDING" ? (
                      <>
                        <PickButtons orderId={o.id} pickStatus={o.pickStatus} />
                        <MarkDeliveredInline orderId={o.id} orderNumber={o.orderNumber} />
                      </>
                    ) : (
                      <span className="pill pill-ok">Levererad</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </details>
          </section>
        );
      })}
    </>
  );
}
