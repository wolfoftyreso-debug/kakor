import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDeliveryDate, toISODate, todayInStockholm, capitalizeFirst } from "@/lib/dates";
import { qtyLabel } from "@/lib/units";
import { MarkDeliveredInline } from "./MarkDeliveredInline";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — leveranser", robots: { index: false } };

// Leveransvyn: verksamhetens arbetsverktyg under leveransdagen.
// Grupperad per datum, byggd för mobil.
export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ visa?: string }>;
}) {
  await requireAdminPage();
  const { visa = "kommande" } = await searchParams;
  const today = todayInStockholm();

  const orders = await prisma.order.findMany({
    where:
      visa === "levererade"
        ? { deliveryStatus: "DELIVERED", status: { not: "CANCELLED" } }
        : {
            // Alla olevererade — även äldre än en vecka, annars försvinner
            // glömda ordrar ur den enda vy verksamheten packar från.
            deliveryStatus: "PENDING",
            status: { not: "CANCELLED" },
          },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
    take: 300,
    include: { items: true, deliveryArea: true },
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
        <div style={{ display: "flex", gap: 8 }}>
          {visa !== "levererade" && sortedKeys.length > 0 && <PrintButton label="Skriv ut körlista" />}
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

      {sortedKeys.length === 0 && (
        <p style={{ color: "var(--text-2)" }}>
          {visa === "levererade" ? "Inga levererade ordrar ännu." : "Inga kommande leveranser."}
        </p>
      )}

      {sortedKeys.map((dateKey) => {
        const dayOrders = groups.get(dateKey)!;
        // Lösvikt och paket summeras separat — "12 kg + 2 paket" är packlistans sanning.
        const allItems = dayOrders.flatMap((o) => o.items);
        const totalKg = allItems.filter((i) => i.unit !== "paket").reduce((s, i) => s + i.weightKg, 0);
        const totalPaket = allItems.filter((i) => i.unit === "paket").reduce((s, i) => s + i.weightKg, 0);
        const dayTotal = [
          totalKg > 0 ? `${totalKg} kg` : null,
          totalPaket > 0 ? `${totalPaket} paket` : null,
        ]
          .filter(Boolean)
          .join(" + ") || "0 kg";
        // Bakplan: hur mycket av varje sort dagen kräver — det är vad som ska
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
              {visa !== "levererade" && dateKey < toISODate(today) ? " — FÖRSENAD, ej markerad levererad" : ""}
            </h2>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
              {dayOrders.length} leverans{dayOrders.length === 1 ? "" : "er"} · {dayTotal} totalt
            </div>
            {visa !== "levererade" && bakplan.length > 0 && (
              <div className="card bakplan" style={{ padding: "12px 18px", marginBottom: 14, background: "var(--butter-soft)" }}>
                <div className="section-label" style={{ marginBottom: 6 }}>BAKPLAN — PER SORT</div>
                <div style={{ display: "flex", gap: "6px 22px", flexWrap: "wrap", fontSize: 14 }}>
                  {bakplan.map((b) => (
                    <span key={`${b.name}|${b.unit}`}>
                      <strong>{qtyLabel(b.qty, b.unit)}</strong> {b.name}{" "}
                      <span style={{ color: "var(--text-2)", fontSize: 12.5 }}>({b.orders} order{b.orders === 1 ? "" : "s"})</span>
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
                      <MarkDeliveredInline orderId={o.id} />
                    ) : (
                      <span className="pill pill-ok">Levererad</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
