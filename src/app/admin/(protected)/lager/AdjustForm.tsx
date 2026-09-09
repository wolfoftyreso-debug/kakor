"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ADJUST_REASONS } from "@/lib/status";
import { adjustStockAction, setMinLevelAction } from "@/app/admin/warehouse-actions";
import type { ActionResult } from "@/app/admin/actions";

export function AdjustForm({
  productId,
  productName,
  unit,
}: {
  productId: string;
  productName: string;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn btn-outline" style={{ padding: "8px 12px", fontSize: 13, minHeight: 44 }} onClick={() => setOpen(true)}>
        Justera lager
      </button>
    );
  }

  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("productId", productId);
        start(async () => {
          const r = await adjustStockAction(fd);
          setResult(r);
          if (r.ok) setOpen(false);
        });
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <label className="visually-hidden" htmlFor={`qty-${productId}`}>
        Mängd {unit} {productName}
      </label>
      <input
        id={`qty-${productId}`}
        name="qty"
        type="number"
        step={unit === "paket" ? 1 : 0.5}
        required
        placeholder={unit === "paket" ? "± paket" : "± kg"}
        style={{ width: 100, padding: "8px 10px", border: "1.5px solid var(--input-border)", borderRadius: 6, fontSize: 13 }}
      />
      <select
        name="reason"
        required
        defaultValue="produktion"
        style={{ padding: "8px 10px", border: "1.5px solid var(--input-border)", borderRadius: 6, fontSize: 13, minHeight: 44 }}
      >
        {ADJUST_REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <input
        name="note"
        placeholder="Anteckning (frivilligt)"
        maxLength={300}
        style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: "1.5px solid var(--input-border)", borderRadius: 6, fontSize: 13 }}
      />
      <button type="submit" className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13, minHeight: 44 }} disabled={pending}>
        {pending ? "Sparar…" : "Spara"}
      </button>
      <button type="button" className="btn btn-outline" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setOpen(false)}>
        Avbryt
      </button>
      {result && !result.ok && (
        <span role="alert" className="error-text" style={{ flexBasis: "100%", fontSize: 13 }}>
          {result.error}
        </span>
      )}
    </form>
  );
}

export function MinLevelForm({ productId, minKg }: { productId: string; minKg: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        const raw = Number(new FormData(e.currentTarget).get("minKg"));
        start(async () => {
          const r = await setMinLevelAction(productId, raw);
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="visually-hidden" htmlFor={`min-${productId}`}>
        Miniminivå kg
      </label>
      <input
        id={`min-${productId}`}
        name="minKg"
        type="number"
        min={0}
        step={0.5}
        defaultValue={minKg || ""}
        placeholder="Min kg"
        style={{ width: 90, padding: "8px 10px", border: "1.5px solid var(--input-border)", borderRadius: 6, fontSize: 13 }}
      />
      <button type="submit" className="btn btn-outline" style={{ padding: "8px 12px", fontSize: 13, minHeight: 40 }} disabled={pending}>
        {pending ? "Sparar…" : "Spara miniminivå"}
      </button>
      {result && (
        <span className={result.ok ? "info-box" : "error-text"} style={{ fontSize: 12.5 }}>
          {result.ok ? result.message : result.error}
        </span>
      )}
    </form>
  );
}
