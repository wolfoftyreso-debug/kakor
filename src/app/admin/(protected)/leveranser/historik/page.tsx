import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/guard";
import { capitalizeFirst, formatDeliveryDate, formatTimestamp } from "@/lib/dates";
import { formatWeightKg } from "@/lib/units";
import { DELIVERY_WEEK_STATUS_LABELS, type DeliveryWeekStatus } from "@/lib/status";
import { listHistoricWeeks } from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin – leveranshistorik", robots: { index: false } };

export default async function HistoryPage() {
  await requireAdminPage();
  const weeks = await listHistoricWeeks();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href="/admin/leveranser" style={{ fontWeight: 600, fontSize: 14 }}>
          ← Leveranser
        </Link>
      </div>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Leveranshistorik</h1>
      <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 20px", maxWidth: "70ch" }}>
        Varje låst vecka behåller sin ursprungliga snapshot. Öppna veckan för att se exakt den lista som användes.
      </p>
      {weeks.length === 0 ? (
        <p style={{ color: "var(--text-2)" }}>Inga låsta leveransveckor ännu.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {weeks.map((w) => (
            <Link
              key={w.id}
              href={`/admin/leveranser/vecka/${w.weekParam}`}
              className="card"
              style={{ padding: "14px 18px", textDecoration: "none", color: "var(--text)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
              <div>
                <strong>
                  {w.weekLabel} · {capitalizeFirst(formatDeliveryDate(w.deliveryDate))}
                </strong>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                  {w.lockedAt ? `Låst ${formatTimestamp(w.lockedAt)}` : DELIVERY_WEEK_STATUS_LABELS[w.status as DeliveryWeekStatus] ?? w.status}
                </div>
              </div>
              <div style={{ fontSize: 14, textAlign: "right" }}>
                {formatWeightKg(w.totalGrams)} · {w.orderCount} leveranser
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
