"use client";

import { useState, useTransition } from "react";
import { markOrderDelivered, type ActionResult } from "@/app/admin/actions";

export function MarkDeliveredInline({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);

  if (!showNote) {
    return (
      <button
        className="btn btn-primary"
        style={{ padding: "12px 16px", fontSize: 13, minHeight: 44 }}
        onClick={() => setShowNote(true)}
      >
        Markera levererad
      </button>
    );
  }

  return (
    <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Leveransnotering (frivilligt)"
        aria-label="Leveransnotering"
        maxLength={500}
        autoFocus
        style={{
          border: "1.5px solid var(--input-border)",
          borderRadius: 6,
          padding: "8px 10px",
          fontSize: 13,
          background: "var(--surface)",
          minWidth: 200,
        }}
      />
      <button
        className="btn btn-primary"
        style={{ padding: "12px 16px", fontSize: 13, minHeight: 44 }}
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await markOrderDelivered(orderId, note)))}
      >
        {pending ? "Sparar…" : "Klar — levererad"}
      </button>
      {result && !result.ok && (
        <span role="alert" className="error-text" style={{ fontSize: 12.5, flexBasis: "100%" }}>
          {result.error}
        </span>
      )}
    </span>
  );
}
