import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { addDays, formatDeliveryDate, toISODate, todayInStockholm } from "@/lib/dates";
import { MarkDeliveredInline } from "./MarkDeliveredInline";

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
            deliveryStatus: "PENDING",
            status: { not: "CANCELLED" },
            deliveryDate: { gte: addDays(today, -7) },
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
        const totalKg = dayOrders.reduce(
          (s, o) => s + o.items.reduce((s2, i) => s2 + i.weightKg, 0),
          0
        );
        return (
          <section key={dateKey} style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 20,
                marginBottom: 4,
                textTransform: "capitalize",
                borderBottom: "2px solid var(--text)",
                paddingBottom: 8,
              }}
            >
              {formatDeliveryDate(dayOrders[0].deliveryDate)}
            </h2>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
              {dayOrders.length} leverans{dayOrders.length === 1 ? "" : "er"} · {totalKg} kg totalt
            </div>
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
                        {o.contactName} · <a href={`tel:${o.phone}`}>{o.phone}</a>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, textAlign: "right", minWidth: 140 }}>
                      {o.items.map((i) => (
                        <div key={i.id}>
                          <strong>{i.weightKg} kg</strong> {i.productName}
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
