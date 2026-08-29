"use client";

import { useState, useTransition } from "react";
import { markOrderDelivered } from "@/app/admin/actions";

export function MarkDeliveredInline({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  if (!showNote) {
    return (
      <button
        className="btn btn-primary"
        style={{ padding: "9px 16px", fontSize: 13 }}
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
        style={{ padding: "9px 16px", fontSize: 13 }}
        disabled={pending}
        onClick={() => startTransition(async () => void (await markOrderDelivered(orderId, note)))}
      >
        {pending ? "Sparar…" : "Klar — levererad"}
      </button>
    </span>
  );
}
