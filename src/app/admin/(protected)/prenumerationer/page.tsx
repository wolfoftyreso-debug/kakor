import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDeliveryDate } from "@/lib/dates";
import type { Prisma } from "@prisma/client";
import { qtyLabel } from "@/lib/units";
import { FREQUENCY_LABELS, type SubscriptionFrequency } from "@/lib/status";
import { SubscriptionActions, GenerateOrdersButton } from "./SubscriptionActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — prenumerationer", robots: { index: false } };

const STATUS_FILTERS = [
  { key: "aktiva", label: "Aktiva & pausade" },
  { key: "avslutade", label: "Avslutade" },
  { key: "alla", label: "Alla" },
];
const PAGE_SIZE = 100;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdminPage();
  const { filter = "aktiva" } = await searchParams;
  // Listan får inte växa obegränsat: filtrera på status och ta högst 100.
  const where: Prisma.SubscriptionWhereInput =
    filter === "avslutade" ? { status: "CANCELLED" } : filter === "alla" ? {} : { status: { in: ["ACTIVE", "PAUSED"] } };
  const totalCount = await prisma.subscription.count({ where });
  const subscriptions = await prisma.subscription.findMany({
    where,
    take: PAGE_SIZE,
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
      <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 16px", maxWidth: "70ch" }}>
        Ordrar för kommande leveranser genereras automatiskt om cron är konfigurerat, annars med
        knappen ovan. Motorn är idempotent — samma period kan aldrig ge två ordrar.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "aktiva" ? "/admin/prenumerationer" : `/admin/prenumerationer?filter=${f.key}`}
            className={filter === f.key ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "8px 14px", fontSize: 13 }}
            aria-current={filter === f.key ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
        <span style={{ alignSelf: "center", fontSize: 13, color: "var(--text-2)" }}>
          {totalCount > PAGE_SIZE ? `Visar ${PAGE_SIZE} av ${totalCount}` : `${totalCount} st`}
        </span>
      </div>

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
                        {qtyLabel(i.weightKg, i.product.unit)} {i.product.name}
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
                    <div style={{ color: "var(--text-2)" }}>
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
