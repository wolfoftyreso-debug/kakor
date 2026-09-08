import type { Metadata } from "next";
import Link from "next/link";
import { getSubscriptionByToken } from "@/lib/subscriptions/manage";
import { getActiveProducts } from "@/lib/products";
import { FREQUENCY_LABELS } from "@/lib/status";
import { calculateTotals, formatOre } from "@/lib/money";
import { effectiveVatRateBp } from "@/lib/vat";
import { capitalizeFirst, formatDeliveryDateWithYear, isoWeekday, toISODate, weekdayName, changeDeadline, formatDeadline } from "@/lib/dates";
import { orderPolicy } from "@/lib/config";
import { qtyLabel } from "@/lib/units";
import { ManageForm } from "./ManageForm";

export const metadata: Metadata = {
  title: "Hantera er fikaprenumeration",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// Självservice: sidan nås bara via den personliga länken i mejlen. Ingen
// inloggning, ingen sökbarhet, inga cachade svar.
export default async function ManageSubscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await getSubscriptionByToken(token);
  if (!sub) {
    return (
      <div className="container-narrow" style={{ padding: "64px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", lineHeight: 1.15 }}>Länken hittades inte</h1>
        <p style={{ maxWidth: "48ch", margin: "12px auto 0", fontSize: 15.5, lineHeight: 1.65, color: "var(--text-2)" }}>
          Länken är ofullständig eller hör till en prenumeration som inte finns. Använd länken
          ”Hantera prenumerationen” i något av mejlen om er fikaprenumeration – den är personlig
          och fungerar tills vidare.
        </p>
        <div style={{ marginTop: 22 }}>
          <Link href="/" className="btn btn-outline">Till startsidan</Link>
        </div>
      </div>
    );
  }
  const products = await getActiveProducts();
  const activeItems = sub.items.filter((i) => i.product.active);
  const totals = calculateTotals(
    activeItems.map((i) => ({ netOre: i.weightKg * i.product.pricePerKgOre, vatRateBp: effectiveVatRateBp(i.product.vatRateBp, toISODate(sub.nextDeliveryDate)) }))
  );
  const weekday = `${weekdayName(isoWeekday(sub.nextDeliveryDate))}ar`;
  const frequency = (FREQUENCY_LABELS[sub.frequency as keyof typeof FREQUENCY_LABELS] ?? sub.frequency).toLowerCase();
  const statusLabel = sub.status === "ACTIVE" ? "Igång" : sub.status === "PAUSED" ? "Pausad" : "Avslutad";
  const upcoming = sub.orders.map((o) => ({
    orderNumber: o.orderNumber,
    date: formatDeliveryDateWithYear(o.deliveryDate),
    deadline: formatDeadline(changeDeadline(o.deliveryDate, orderPolicy.changeCutoffWorkdays, orderPolicy.changeCutoffHour)),
  }));

  return (
    <div className="container-narrow" style={{ padding: "24px 24px 80px" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Fikaprenumeration {sub.number}</div>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", lineHeight: 1.12, marginBottom: 8 }}>Hantera er fikaprenumeration</h1>
      <p style={{ color: "var(--text-2)", fontSize: 15.5, margin: "0 0 22px", maxWidth: "58ch" }}>
        {sub.companyName} · {sub.deliveryAddress}, {sub.deliveryPostalCode} {sub.deliveryCity}
        {sub.deliveryArea ? ` · ${sub.deliveryArea.name}` : ""}. Den här sidan är personlig – dela inte länken.
      </p>

      <div className="card" style={{ padding: "22px 24px", marginBottom: 18, display: "grid", gap: 8, fontSize: 15 }}>
        <div><strong>Status:</strong> {statusLabel}</div>
        <div>
          <strong>Nästa leverans:</strong>{" "}
          {sub.status === "CANCELLED" ? "–" : `${capitalizeFirst(formatDeliveryDateWithYear(sub.nextDeliveryDate))}, därefter ${frequency} på ${weekday}`}
        </div>
        <div>
          <strong>Innehåll:</strong>{" "}
          {activeItems.map((i) => `${qtyLabel(i.weightKg, i.product.unit)} ${i.product.name}`).join(", ") || "–"}
        </div>
        <div>
          <strong>Per leverans:</strong> {formatOre(totals.totalOre)} inkl. moms ({formatOre(totals.subtotalOre)} exkl. moms), enligt dagens priser
        </div>
        <div style={{ color: "var(--text-2)", fontSize: 14 }}>Fakturan går till {sub.invoiceEmail}, en per leverans.</div>
      </div>

      {upcoming.length > 0 && (
        <div className="info-box" style={{ marginBottom: 18, fontSize: 14.5 }}>
          <strong>Redan bekräftad{upcoming.length > 1 ? "e leveranser" : " leverans"}:</strong>{" "}
          {upcoming.map((o) => `${o.date} (${o.orderNumber}, ändras senast ${o.deadline})`).join("; ")}.
          Ändringar här gäller från nästa leverans efter dessa – svara på orderbekräftelsen om ni vill ändra en bekräftad leverans.
        </div>
      )}

      {sub.status === "CANCELLED" ? (
        <div className="info-box-muted" style={{ fontSize: 15 }}>
          Prenumerationen är avslutad. Vill ni ha fika igen? <Link href="/bestall?typ=aterkommande">Starta en ny fikaprenumeration</Link>.
        </div>
      ) : (
        <ManageForm
          token={token}
          status={sub.status}
          frequency={sub.frequency}
          items={activeItems.map((i) => ({ productId: i.productId, weightKg: i.weightKg }))}
          products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, pricePerKgOre: p.pricePerKgOre }))}
        />
      )}
      <p style={{ marginTop: 28, fontSize: 14, color: "var(--text-2)" }}>
        Något annat – ny adress, annan faktura-e-post, en fråga? Svara på något av mejlen om prenumerationen så ordnar vi det.
      </p>
    </div>
  );
}
