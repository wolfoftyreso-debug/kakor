"use client";

import { useActionState } from "react";
import { weekdayName } from "@/lib/dates";
import { saveOpsSettingsAction } from "@/app/admin/warehouse-actions";

export function OpsSettingsForm({
  cutoffWeekday,
  cutoffHour,
  opsEmail,
}: {
  cutoffWeekday: number;
  cutoffHour: number;
  opsEmail: string;
}) {
  const [state, action, pending] = useActionState(saveOpsSettingsAction, null);
  return (
    <form action={action} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <label className="field">
        Cutoff-veckodag (1–7)
        <input name="cutoffWeekday" type="number" min={1} max={7} defaultValue={cutoffWeekday} required />
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          {weekdayName(cutoffWeekday) ? `Just nu: ${weekdayName(cutoffWeekday)}` : "3 = onsdag"}
        </span>
      </label>
      <label className="field">
        Cutoff-klockslag (0–23, svensk tid)
        <input name="cutoffHour" type="number" min={0} max={23} defaultValue={cutoffHour} required />
      </label>
      <label className="field">
        Driftmejl (kommaseparerat, tomt = admin-avisering)
        <input name="opsEmail" type="text" defaultValue={opsEmail} placeholder="drift@exempel.se" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Sparar…" : "Spara cutoff"}
      </button>
      {state?.error && <p className="error-text">{state.error}</p>}
      {state?.saved && <p className="info-box">{state.saved}</p>}
    </form>
  );
}
