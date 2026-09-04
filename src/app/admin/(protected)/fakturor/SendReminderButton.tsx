"use client";

import { useState, useTransition } from "react";
import { sendPaymentReminder, type ActionResult } from "@/app/admin/actions";

/** Påminnelse direkt från reskontran — visas bara på förfallna fakturor. */
export function SendReminderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        className="btn btn-outline"
        style={{ padding: "8px 12px", fontSize: 12.5, minHeight: 36 }}
        disabled={pending || result?.ok === true}
        onClick={() => {
          if (!window.confirm("Skicka betalningspåminnelse till kundens faktura-e-post?")) return;
          startTransition(async () => setResult(await sendPaymentReminder(orderId)));
        }}
      >
        {pending ? "Skickar…" : result?.ok ? "Påminnelse skickad" : "Påminn"}
      </button>
      {result && !result.ok && (
        <span role="alert" className="error-text" style={{ fontSize: 12 }}>
          {result.error}
        </span>
      )}
    </span>
  );
}
