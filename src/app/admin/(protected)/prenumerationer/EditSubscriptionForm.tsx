"use client";

import { useState, useTransition } from "react";
import { updateSubscriptionContents, type ActionResult } from "@/app/admin/actions";
import { FREQUENCY_LABELS, SUBSCRIPTION_FREQUENCY } from "@/lib/status";

interface ProductOption {
  id: string;
  name: string;
  unit: string;
}

/** Ändra sorter, mängder och intervall — gäller från nästa leverans. */
export function EditSubscriptionForm({
  subscriptionId,
  frequency,
  items,
  products,
}: {
  subscriptionId: string;
  frequency: string;
  items: { productId: string; weightKg: number }[];
  products: ProductOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [freq, setFreq] = useState(frequency);
  const [lines, setLines] = useState(items.map((i) => ({ ...i })));
  const [result, setResult] = useState<ActionResult | null>(null);
  const unused = products.filter((p) => !lines.some((l) => l.productId === p.id));

  return (
    <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>Ändra innehåll eller intervall</summary>
      <div className="card" style={{ padding: 16, marginTop: 10, display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
        <label className="field">
          Intervall
          <select value={freq} onChange={(e) => setFreq(e.target.value)}>
            {SUBSCRIPTION_FREQUENCY.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        {lines.map((l, idx) => {
          const p = products.find((x) => x.id === l.productId);
          return (
            <div key={l.productId} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <span style={{ flex: 1 }}>{p?.name ?? "Okänd sort"}</span>
              <input
                type="number"
                min={1}
                max={100}
                value={l.weightKg}
                aria-label={`Antal ${p?.unit ?? "kg"} ${p?.name ?? ""}`}
                onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, weightKg: parseInt(e.target.value, 10) || 1 } : x)))}
                style={{ width: 80, border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "7px 10px", background: "var(--surface)" }}
              />
              <span style={{ width: 44, color: "var(--text-2)" }}>{p?.unit ?? "kg"}</span>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: "6px 10px", fontSize: 12 }}
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
              >
                Ta bort
              </button>
            </div>
          );
        })}
        {unused.length > 0 && (
          <label className="field">
            Lägg till sort
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setLines((ls) => [...ls, { productId: e.target.value, weightKg: 1 }]);
              }}
            >
              <option value="">Välj…</option>
              {unused.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {result && (
          <div role={result.ok ? "status" : "alert"} className={result.ok ? "info-box" : "error-text"} style={{ fontSize: 13.5 }}>
            {result.ok ? result.message : result.error}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          style={{ alignSelf: "flex-start", padding: "9px 16px", fontSize: 13.5 }}
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await updateSubscriptionContents(subscriptionId, freq, lines)))}
        >
          {pending ? "Sparar…" : "Spara ändring"}
        </button>
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          Gäller från nästa leverans. Redan skapade ordrar och fakturor ändras inte.
        </span>
      </div>
    </details>
  );
}
