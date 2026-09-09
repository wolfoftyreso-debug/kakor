import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/guard";
import {
  capitalizeFirst,
  formatDeliveryDateWithYear,
  formatIsoWeekLabel,
  formatTimestamp,
  parseIsoWeekParam,
} from "@/lib/dates";
import { DELIVERY_WEEK_STATUS_LABELS, type DeliveryWeekStatus } from "@/lib/status";
import { formatWeightKg, qtyLabel } from "@/lib/units";
import { isWeekLockedStatus, loadWeekOps, sortStopsByRoute } from "@/lib/warehouse/queries";
import { PrintButton } from "@/components/admin/PrintButton";
import { PickButtons } from "../../PickButtons";
import { WeekActions } from "../../WeekActions";
import { AreaBookingBars } from "@/components/admin/AreaBooking";
import { overdueOrgNumbers } from "@/lib/orders/overdue";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin – leveransvecka", robots: { index: false } };

export default async function WeekPage({ params }: { params: Promise<{ yw: string }> }) {
  await requireAdminPage();
  const { yw } = await params;
  const parsed = parseIsoWeekParam(yw);
  if (!parsed) notFound();
  const days = await loadWeekOps(parsed.year, parsed.week);
  const title = `${formatIsoWeekLabel(parsed.year, parsed.week)} ${parsed.year}`;

  if (days.length === 0) {
    return (
      <>
        <p>
          <Link href="/admin/leveranser" style={{ fontWeight: 600, fontSize: 14 }}>
            ← Leveranser
          </Link>
        </p>
        <h1 style={{ fontSize: 26 }}>{title}</h1>
        <p style={{ color: "var(--text-2)" }}>Inga leveranser den här veckan.</p>
      </>
    );
  }

  return (
    <>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href="/admin/leveranser" style={{ fontWeight: 600, fontSize: 14 }}>
          ← Leveranser
        </Link>
        <Link href="/admin/leveranser/historik" style={{ fontWeight: 600, fontSize: 14 }}>
          Historik
        </Link>
      </div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{title}</h1>

      {days.map((day) => (
        <DaySection key={day.iso} day={day} />
      ))}
    </>
  );
}

async function DaySection({ day }: { day: Awaited<ReturnType<typeof loadWeekOps>>[number] }) {
  const locked = isWeekLockedStatus(day.status);
  const dateLabel = capitalizeFirst(formatDeliveryDateWithYear(day.deliveryDate));
  const stops = sortStopsByRoute(day.snapshot?.stops ?? day.liveStops);
  const pickByOrder = await loadPickMap(stops.map((s) => s.orderId));
  const overdueOrgs = await overdueOrgNumbers();

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", borderBottom: "2px solid var(--text)", paddingBottom: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>{dateLabel}</h2>
        <WeekStatusBadge status={day.status} lockedAt={day.lockedAt} />
      </div>

      {day.status === "LOCKED" || locked ? (
        <p style={{ fontSize: 14, margin: "0 0 12px" }}>
          {day.lockedAt ? (
            <>
              🔒 Låst {formatTimestamp(day.lockedAt)}
              {day.lockedBy ? ` · ${day.lockedBy}` : ""}
            </>
          ) : (
            "🔒 Låst"
          )}
        </p>
      ) : null}

      {day.lastError && (
        <div role="alert" className="error-text" style={{ marginBottom: 12, padding: "10px 12px" }}>
          {day.lastError}
        </div>
      )}

      <div style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 14 }}>
        {day.orderCount} {day.orderCount === 1 ? "leverans" : "leveranser"} · {formatWeightKg(day.totalGrams)} totalt
        {day.subscriptionCount > 0 ? ` · ${day.subscriptionCount} prenumeration${day.subscriptionCount === 1 ? "" : "er"}` : ""}
      </div>

      {day.byArea.length > 0 && (
        <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Bokat per område</div>
          <AreaBookingBars areas={day.byArea} />
        </div>
      )}

      <div className="card" style={{ padding: "14px 18px", marginBottom: 14, background: "var(--butter-soft)" }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Vad ska vi baka?</div>
        {day.byProduct.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14 }}>Inget beställt.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14.5 }}>
            {day.byProduct.map((p) => (
              <div key={`${p.productId}|${p.name}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span>
                  <strong>{qtyLabel(p.orderedQty, p.unit)}</strong> {p.name}
                  <span style={{ color: "var(--text-2)" }}> · fysiskt {formatWeightKg(p.physicalGrams)}</span>
                </span>
                <span style={{ fontWeight: 700, color: p.needGrams > 0 ? "var(--red)" : "var(--text-2)" }}>
                  {p.needGrams > 0 ? `Produktionsbehov +${formatWeightKg(p.needGrams)}` : "Täcks av lagret"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <PrintButton label="Skriv ut sidan" />
        <a className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }} href={`/admin/leveranser/underlag/${day.iso}?typ=lista`}>
          Ladda ned leveranslista (PDF)
        </a>
        <a className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }} href={`/admin/leveranser/underlag/${day.iso}?typ=plock`}>
          Ladda ned plocklista (PDF)
        </a>
        <a className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }} href={`/admin/leveranser/underlag/${day.iso}?typ=sedlar`}>
          Ladda ned alla leveranssedlar (PDF)
        </a>
        <Link className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }} href={`/admin/leveranser/vecka/${day.weekParam}/foljesedlar?dag=${day.iso}`}>
          Skriv ut alla leveranssedlar
        </Link>
        <Link className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }} href="/admin/leveranser">
          Körlista
        </Link>
      </div>

      <WeekActions iso={day.iso} locked={locked} emailSent={!!day.opsEmailSentAt} />

      <h3 style={{ fontSize: 18, margin: "24px 0 10px" }}>Vart ska det?</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stops.map((stop, idx, arr) => {
            const areaName = stop.areaName ?? stop.deliveryCity;
            const prevArea = idx > 0 ? (arr[idx - 1].areaName ?? arr[idx - 1].deliveryCity) : null;
            const showArea = areaName !== prevArea;
            return (
          <div key={stop.orderId}>
            {showArea && (
              <div className="section-label" style={{ margin: idx === 0 ? "0 0 8px" : "14px 0 8px" }}>
                {areaName}
              </div>
            )}
          <article className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="section-label">Stopp {idx + 1}</div>
                <strong style={{ fontSize: 16 }}>{stop.companyName}</strong>{" "}
                <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {stop.orderNumber}
                </span>
                {stop.subscriptionNumber && (
                  <span className="pill pill-outline" style={{ marginLeft: 8 }}>
                    Prenum. {stop.subscriptionNumber}
                  </span>
                )}
                {overdueOrgs.has(stop.orgNumber) && (
                  <span className="pill pill-warn" style={{ marginLeft: 8 }}>
                    Förfallen fordran
                  </span>
                )}
                <div style={{ fontSize: 13.5, marginTop: 4 }}>
                  {stop.deliveryAddress}, {stop.deliveryPostalCode} {stop.deliveryCity}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                  {stop.contactName}
                  {stop.phone ? <> · <a href={`tel:${stop.phone}`}>{stop.phone}</a></> : null}
                </div>
              </div>
              <div style={{ fontSize: 14, textAlign: "right" }}>
                {stop.items.map((i) => (
                  <div key={`${i.productName}|${i.unit}`}>
                    <strong>{qtyLabel(i.qty, i.unit)}</strong> {i.productName}
                  </div>
                ))}
              </div>
            </div>
            {stop.deliveryInstruction && (
              <div className="info-box" style={{ marginTop: 10, fontSize: 13.5 }}>
                {stop.deliveryInstruction}
              </div>
            )}
            <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={`/admin/bestallningar/${stop.orderId}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
                Order
              </Link>
              <Link href={`/admin/bestallningar/${stop.orderId}/foljesedel`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
                Leveranssedel
              </Link>
              <PickButtons orderId={stop.orderId} pickStatus={pickByOrder.get(stop.orderId) ?? "UNPICKED"} />
            </div>
          </article>
          </div>
            );
          })}
      </div>

      <h3 style={{ fontSize: 18, margin: "28px 0 10px" }}>Plocklista</h3>
      <PickList stops={stops} pickByOrder={pickByOrder} />

      {day.postCutoffStops.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Efter cutoff</h3>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", maxWidth: "70ch" }}>
            De här ordrarna finns live men ingick inte i den låsta listan. Den ursprungliga listan är oförändrad.
          </p>
          {day.postCutoffStops.map((s) => (
            <div key={s.orderId} className="card" style={{ padding: "12px 16px", marginTop: 8 }}>
              <strong>{s.companyName}</strong> · {s.orderNumber} · {formatWeightKg(s.totalGrams)}
            </div>
          ))}
        </div>
      )}

      {day.lateChanges.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Efterhandsändringar</h3>
          {day.lateChanges.map((c) => (
            <div key={c.id} className="card" style={{ padding: "12px 16px", marginBottom: 8, fontSize: 13.5 }}>
              <strong>{c.type === "NOTE" ? "Anteckning" : c.type}</strong> · {c.actor} · {formatTimestamp(new Date(c.at))}
              <div>{c.reason}</div>
              <div style={{ color: "var(--text-2)" }}>{c.detail}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WeekStatusBadge({ status, lockedAt }: { status: string; lockedAt: Date | null }) {
  const locked = isWeekLockedStatus(status);
  return (
    <span className={`pill ${locked ? "pill-ok" : status === "OPEN" ? "pill-new" : "pill-outline"}`}>
      {locked ? "Låst" : DELIVERY_WEEK_STATUS_LABELS[status as DeliveryWeekStatus] ?? status}
      {lockedAt ? "" : ""}
    </span>
  );
}

async function loadPickMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, pickStatus: true } });
  return new Map(rows.map((r) => [r.id, r.pickStatus]));
}

function PickList({
  stops,
  pickByOrder,
}: {
  stops: { orderId: string; companyName: string; items: { productName: string; qty: number; unit: string; productId: string | null }[] }[];
  pickByOrder: Map<string, string>;
}) {
  const groups = new Map<string, { name: string; unit: string; qty: number; rows: { orderId: string; company: string; qty: number; unit: string }[] }>();
  for (const s of stops) {
    for (const i of s.items) {
      const key = `${i.productId ?? i.productName}|${i.unit}`;
      const cur = groups.get(key) ?? { name: i.productName, unit: i.unit, qty: 0, rows: [] };
      cur.qty += i.qty;
      cur.rows.push({ orderId: s.orderId, company: s.companyName, qty: i.qty, unit: i.unit });
      groups.set(key, cur);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[...groups.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
        .map((g) => (
          <div key={`${g.name}|${g.unit}`} className="card" style={{ padding: "14px 16px" }}>
            <div className="section-label" style={{ marginBottom: 8 }}>
              {g.name} · totalt {qtyLabel(g.qty, g.unit)}
            </div>
            {g.rows.map((r) => {
              const picked = pickByOrder.get(r.orderId);
              const done = picked === "PICKED" || picked === "LOADED" || picked === "DELIVERED";
              return (
                <div key={`${r.orderId}|${r.unit}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", fontSize: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <span>
                    {done ? "☑" : "☐"} {r.company} – {qtyLabel(r.qty, r.unit)}
                  </span>
                  <PickButtons orderId={r.orderId} pickStatus={picked ?? "UNPICKED"} />
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
