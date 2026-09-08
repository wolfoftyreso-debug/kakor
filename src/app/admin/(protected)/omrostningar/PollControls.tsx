"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearWinner, deleteCandidate, linkWinnerProduct, setPollStatus, setWinner, type PollActionResult } from "@/app/admin/poll-actions";

interface Candidate {
  id: string;
  name: string;
  votes: number;
  productId: string | null;
}

export function PollControls({
  pollId,
  status,
  state,
  winnerId,
  leaderId,
  candidates,
  products,
}: {
  pollId: string;
  status: string;
  state: string;
  winnerId: string | null;
  leaderId: string | null;
  candidates: Candidate[];
  products: { id: string; name: string; active: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PollActionResult | null>(null);
  const [winnerPick, setWinnerPick] = useState(winnerId ?? leaderId ?? candidates[0]?.id ?? "");
  const [productPick, setProductPick] = useState(candidates.find((c) => c.id === winnerId)?.productId ?? "");
  const run = (fn: () => Promise<PollActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });
  const btn = { padding: "8px 14px", fontSize: 13 } as const;

  return (
    <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
      {result && (
        <div role={result.ok ? "status" : "alert"} className={result.ok ? "info-box" : "error-text"} style={{ fontSize: 13.5 }}>
          {result.ok ? result.message : result.error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 14 }}>Status: {state}</strong>
        {status !== "ACTIVE" && !winnerId && (
          <button type="button" className="btn btn-primary" style={btn} disabled={pending} onClick={() => run(() => setPollStatus(pollId, "ACTIVE"))}>
            Öppna omgången
          </button>
        )}
        {status === "ACTIVE" && (
          <button type="button" className="btn btn-outline" style={btn} disabled={pending} onClick={() => run(() => setPollStatus(pollId, "CLOSED"))}>
            Stäng omgången nu
          </button>
        )}
        {status !== "DRAFT" && !winnerId && (
          <button type="button" className="btn btn-outline" style={btn} disabled={pending} onClick={() => run(() => setPollStatus(pollId, "DRAFT"))}>
            Gör till utkast
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 14 }}>
        <label htmlFor="poll-winner">Vinnare:</label>
        <select id="poll-winner" value={winnerPick} onChange={(e) => setWinnerPick(e.target.value)} disabled={!!winnerId} style={{ padding: "7px 10px", border: "1.5px solid var(--input-border)", borderRadius: 6, background: "var(--surface)" }}>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.votes} röster){c.id === leaderId ? " – leder" : ""}
            </option>
          ))}
        </select>
        {winnerId ? (
          <button type="button" className="btn btn-outline" style={btn} disabled={pending} onClick={() => run(() => clearWinner(pollId))}>
            Återkalla vinnaren
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            style={btn}
            disabled={pending || !winnerPick}
            onClick={() => {
              if (window.confirm("Utse vinnaren och stäng omgången? Publiceras direkt på sajten.")) run(() => setWinner(pollId, winnerPick));
            }}
          >
            Utse vinnare och stäng
          </button>
        )}
      </div>
      {winnerId && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 14 }}>
          <label htmlFor="poll-product">Lanserad som produkt:</label>
          <select id="poll-product" value={productPick} onChange={(e) => setProductPick(e.target.value)} style={{ padding: "7px 10px", border: "1.5px solid var(--input-border)", borderRadius: 6, background: "var(--surface)" }}>
            <option value="">Inte lanserad än</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.active ? "" : " (inaktiv)"}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-outline" style={btn} disabled={pending} onClick={() => run(() => linkWinnerProduct(pollId, winnerId, productPick || null))}>
            Spara koppling
          </button>
          <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>Skapa produkten under Produkter först. Kopplingen ger ”Folkets val” med beställningsknapp.</span>
        </div>
      )}
      {candidates.some((c) => c.votes === 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "var(--text-2)" }}>Ta bort kandidat utan röster:</span>
          {candidates.filter((c) => c.votes === 0).map((c) => (
            <button
              key={c.id}
              type="button"
              className="btn btn-outline"
              style={{ ...btn, borderColor: "var(--red)", color: "var(--red)" }}
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Ta bort ${c.name}?`)) run(() => deleteCandidate(pollId, c.id));
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
