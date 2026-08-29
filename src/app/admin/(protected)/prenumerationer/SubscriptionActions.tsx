"use client";

import { useState, useTransition } from "react";
import {
  runSubscriptionGeneration,
  setSubscriptionNextDate,
  setSubscriptionStatus,
} from "@/app/admin/actions";

export function SubscriptionActions({
  id,
  status,
  nextDeliveryDate,
}: {
  id: string;
  status: string;
  nextDeliveryDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(nextDeliveryDate);
  const run = (fn: () => Promise<unknown>) => startTransition(async () => void (await fn()));

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {status === "ACTIVE" && (
        <button className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }} disabled={pending} onClick={() => run(() => setSubscriptionStatus(id, "PAUSED"))}>
          Pausa
        </button>
      )}
      {status === "PAUSED" && (
        <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }} disabled={pending} onClick={() => run(() => setSubscriptionStatus(id, "ACTIVE"))}>
          Återaktivera
        </button>
      )}
      {status !== "CANCELLED" && (
        <>
          <button
            className="btn btn-outline"
            style={{ padding: "8px 14px", fontSize: 13, borderColor: "var(--red)", color: "var(--red)" }}
            disabled={pending}
            onClick={() => {
              if (window.confirm("Avsluta prenumerationen? Historiken behålls.")) {
                run(() => setSubscriptionStatus(id, "CANCELLED"));
              }
            }}
          >
            Avsluta
          </button>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            Nästa leverans:
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ border: "1.5px solid var(--input-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, background: "var(--surface)" }}
            />
            <button
              className="btn btn-outline"
              style={{ padding: "8px 12px", fontSize: 12.5 }}
              disabled={pending || date === nextDeliveryDate}
              onClick={() => run(() => setSubscriptionNextDate(id, date))}
            >
              Spara
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export function GenerateOrdersButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {result && <span style={{ fontSize: 13, color: "var(--text-2)" }}>{result}</span>}
      <button
        className="btn btn-primary"
        style={{ padding: "10px 18px", fontSize: 14 }}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await runSubscriptionGeneration();
            setResult(`Genererade ${r.generated} order${r.generated === 1 ? "" : "rar"}, hoppade över ${r.skipped}.`);
          })
        }
      >
        {pending ? "Genererar…" : "Generera kommande prenumerationsleveranser"}
      </button>
    </span>
  );
}
