"use client";

import { useState, useTransition } from "react";
import { FREQUENCY_LABELS, SUBSCRIPTION_FREQUENCY } from "@/lib/status";
import { formatOre } from "@/lib/money";
import { priceSuffix } from "@/lib/units";
import type { ManageResult } from "@/lib/subscriptions/manage";
import {
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipNextDeliveryAction,
  updateSubscriptionAction,
} from "./actions";

interface ProductOption {
  id: string;
  name: string;
  unit: string;
  pricePerKgOre: number;
}

export function ManageForm({
  token,
  status,
  frequency,
  items,
  products,
}: {
  token: string;
  status: string;
  frequency: string;
  items: { productId: string; weightKg: number }[];
  products: ProductOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ManageResult | null>(null);
  const [freq, setFreq] = useState(frequency);
  const [lines, setLines] = useState(products.map((p) => ({ productId: p.id, weightKg: items.find((i) => i.productId === p.id)?.weightKg ?? 0 })));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const run = (fn: () => Promise<ManageResult>) =>
    startTransition(async () => {
      setResult(null);
      setResult(await fn());
    });
  const btn = { padding: "11px 18px", fontSize: 14.5 } as const;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {result && (
        <div role={result.ok ? "status" : "alert"} className={result.ok ? "info-box" : "error-text"} style={{ fontSize: 14.5, padding: result.ok ? undefined : "12px 14px" }}>
          {result.ok ? result.message : result.error}
        </div>
      )}

      <section className="card" style={{ padding: "20px 22px" }}>
        <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Paus och nästa leverans</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 14px" }}>
          Pausen stoppar nya leveranser tills ni startar igen. ”Hoppa över nästa” flyttar fram en leverans och behåller rytmen.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {status === "ACTIVE" ? (
            <>
              <button type="button" className="btn btn-outline" style={btn} disabled={pending} onClick={() => run(() => pauseSubscriptionAction(token))}>
                Pausa prenumerationen
              </button>
              <button type="button" className="btn btn-outline" style={btn} disabled={pending} onClick={() => run(() => skipNextDeliveryAction(token))}>
                Hoppa över nästa leverans
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" style={btn} disabled={pending} onClick={() => run(() => resumeSubscriptionAction(token))}>
              Starta prenumerationen igen
            </button>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: "20px 22px" }}>
        <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Ändra innehåll eller intervall</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 14px" }}>Gäller från nästa leverans. Sätt 0 på en sort för att ta bort den.</p>
        <div className="field" style={{ maxWidth: 320, marginBottom: 12 }}>
          <label htmlFor="hantera-intervall">Intervall</label>
          <select id="hantera-intervall" value={freq} onChange={(e) => setFreq(e.target.value)}>
            {SUBSCRIPTION_FREQUENCY.map((f) => (
              <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {products.map((p) => {
            const line = lines.find((l) => l.productId === p.id)!;
            return (
              <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 15 }}>
                <label htmlFor={`hantera-${p.id}`} style={{ flex: 1 }}>
                  {p.name} <span style={{ color: "var(--text-2)", fontSize: 13 }}>{formatOre(p.pricePerKgOre)}{priceSuffix(p.unit)} exkl. moms</span>
                </label>
                <input
                  id={`hantera-${p.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={line.weightKg}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setLines((ls) => ls.map((l) => (l.productId === p.id ? { ...l, weightKg: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 } : l)));
                  }}
                  style={{ width: 84, border: "1.5px solid var(--input-border)", borderRadius: "var(--radius)", padding: "9px 12px", fontSize: 15, background: "var(--surface)" }}
                />
                <span style={{ width: 48, color: "var(--text-2)" }}>{p.unit}</span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ ...btn, marginTop: 14 }}
          disabled={pending}
          onClick={() => run(() => updateSubscriptionAction(token, freq, lines.filter((l) => l.weightKg > 0)))}
        >
          {pending ? "Sparar…" : "Spara ändring"}
        </button>
      </section>

      <section className="card" style={{ padding: "20px 22px" }}>
        <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Avsluta</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 12px" }}>
          Inga fler leveranser eller fakturor skapas. Redan bekräftade leveranser kommer som planerat. Ni är välkomna tillbaka när som helst.
        </p>
        <label className="checkbox-label" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={confirmCancel} onChange={(e) => setConfirmCancel(e.target.checked)} />
          Ja, avsluta fikaprenumerationen
        </label>
        <div>
          <button type="button" className="btn btn-outline" style={{ ...btn, borderColor: "var(--red)", color: "var(--red)" }} disabled={pending || !confirmCancel} onClick={() => run(() => cancelSubscriptionAction(token))}>
            Avsluta prenumerationen
          </button>
        </div>
      </section>
    </div>
  );
}
