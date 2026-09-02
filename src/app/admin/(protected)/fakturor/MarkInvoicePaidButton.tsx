"use client";

import { useState, useTransition } from "react";
import { markOrderPaid, type ActionResult } from "@/app/admin/actions";

export function MarkInvoicePaidButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        className="btn btn-outline"
        style={{ padding: "8px 12px", fontSize: 12.5, minHeight: 36 }}
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Markera fakturan som betald? Detta går inte att ångra.")) return;
          startTransition(async () => setResult(await markOrderPaid(orderId, "")));
        }}
      >
        {pending ? "Sparar…" : "Markera betald"}
      </button>
      {result && !result.ok && (
        <span role="alert" className="error-text" style={{ fontSize: 12 }}>
          {result.error}
        </span>
      )}
    </span>
  );
}
