"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockWeekAction, resendWeekEmailAction, addLateNoteAction } from "@/app/admin/warehouse-actions";
import type { ActionResult } from "@/app/admin/actions";

export function WeekActions({
  iso,
  locked,
  emailSent,
}: {
  iso: string;
  locked: boolean;
  emailSent: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [showLate, setShowLate] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });

  return (
    <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {!locked && (
          <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={pending} onClick={() => run(() => lockWeekAction(iso))}>
            Lås leveranslistan nu
          </button>
        )}
        {locked && (
          <button type="button" className="btn btn-outline" style={{ minHeight: 44 }} disabled={pending} onClick={() => run(() => resendWeekEmailAction(iso))}>
            {emailSent ? "Skicka leveranslista igen" : "Skicka leveranslista"}
          </button>
        )}
        {locked && (
          <button type="button" className="btn btn-outline" style={{ minHeight: 44 }} onClick={() => setShowLate((v) => !v)}>
            Registrera efterhandsändring
          </button>
        )}
      </div>
      {showLate && (
        <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="field">
            Anledning
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </label>
          <label className="field">
            Vad ändrades
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={1000} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => run(() => addLateNoteAction(iso, reason, detail))}
          >
            Spara efterhandsändring
          </button>
        </div>
      )}
      {result && (
        <div role={result.ok ? "status" : "alert"} className={result.ok ? "info-box" : "error-text"} style={{ fontSize: 14 }}>
          {result.ok ? result.message : result.error}
        </div>
      )}
    </div>
  );
}
