import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDeliveryDate } from "@/lib/dates";
import { FREQUENCY_LABELS, type SubscriptionFrequency } from "@/lib/status";
import { SubscriptionActions, GenerateOrdersButton } from "./SubscriptionActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — prenumerationer", robots: { index: false } };

export default async function SubscriptionsPage() {
  await requireAdminPage();
  const subscriptions = await prisma.subscription.findMany({
    orderBy: [{ status: "asc" }, { nextDeliveryDate: "asc" }],
    include: {
      items: { include: { product: true } },
      deliveryArea: true,
      orders: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 26 }}>Prenumerationer</h1>
        <GenerateOrdersButton />
      </div>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 24px", maxWidth: "70ch" }}>
        Ordrar för kommande leveranser genereras automatiskt om cron är konfigurerat, annars med
        knappen ovan. Motorn är idempotent — samma period kan aldrig ge två ordrar.
      </p>

      {subscriptions.length === 0 ? (
        <p style={{ color: "var(--text-2)" }}>Inga prenumerationer ännu.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {subscriptions.map((s) => (
            <div key={s.id} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{s.companyName}</strong>{" "}
                  <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{s.number}</span>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 2 }}>
                    {s.contactName} · {s.email}
                    {s.deliveryArea ? ` · ${s.deliveryArea.name}` : ""}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 8 }}>
                    {s.items.map((i) => (
                      <span key={i.id} className="chip" style={{ marginRight: 6 }}>
                        {i.weightKg} kg {i.product.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 14 }}>
                  <span
                    className={`pill ${s.status === "ACTIVE" ? "pill-ok" : s.status === "PAUSED" ? "pill-new" : "pill-neutral"}`}
                  >
                    {s.status === "ACTIVE" ? "Aktiv" : s.status === "PAUSED" ? "Pausad" : "Avslutad"}
                  </span>
                  <div style={{ marginTop: 8 }}>
                    {FREQUENCY_LABELS[s.frequency as SubscriptionFrequency] ?? s.frequency}
                  </div>
                  {s.status !== "CANCELLED" && (
                    <div style={{ color: "var(--text-2)", textTransform: "capitalize" }}>
                      Nästa: {formatDeliveryDate(s.nextDeliveryDate)}
                    </div>
                  )}
                </div>
              </div>

              {s.orders.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-2)" }}>
                  Senaste ordrar:{" "}
                  {s.orders.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && " · "}
                      <Link href={`/admin/bestallningar/${o.id}`} className="mono" style={{ fontSize: 12.5 }}>
                        {o.orderNumber}
                      </Link>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <SubscriptionActions
                  id={s.id}
                  status={s.status}
                  nextDeliveryDate={s.nextDeliveryDate.toISOString().slice(0, 10)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
