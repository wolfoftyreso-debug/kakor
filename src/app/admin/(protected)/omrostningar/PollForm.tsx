"use client";

import { useActionState } from "react";
import { savePoll } from "@/app/admin/poll-actions";

export function PollForm({
  pollId,
  initial,
}: {
  pollId: string | null;
  initial: { slug: string; sequence: number; title: string; intro: string; deadlineLabel: string; startsAt: string; endsAt: string; status: string };
}) {
  const action = savePoll.bind(null, pollId);
  const [state, formAction, pending] = useActionState(action, null);
  const v = state?.values;
  return (
    <form action={formAction} className="card" style={{ padding: 18, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
      <label className="field">
        Löpnummer (Folkets val #)
        <input name="sequence" type="number" min={1} max={999} defaultValue={v?.sequence ?? initial.sequence} required />
      </label>
      <label className="field">
        Slug (adress)
        <input name="slug" defaultValue={v?.slug ?? initial.slug} placeholder="folkets-nasta-smakaka-2" required />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Rubrik
        <input name="title" defaultValue={v?.title ?? initial.title} required />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Ingress
        <textarea name="intro" rows={3} defaultValue={v?.intro ?? initial.intro} />
      </label>
      <label className="field">
        Etikett för slutdatumet (t.ex. Luciadagen den 13 december)
        <input name="deadlineLabel" defaultValue={v?.deadlineLabel ?? initial.deadlineLabel} />
      </label>
      <label className="field">
        Status
        <select name="status" defaultValue={v?.status ?? initial.status}>
          <option value="DRAFT">Utkast (visas inte)</option>
          <option value="ACTIVE">Aktiv (öppen mellan start och slut)</option>
          <option value="CLOSED">Stängd</option>
        </select>
      </label>
      <label className="field">
        Öppnar (svensk tid)
        <input name="startsAt" type="datetime-local" defaultValue={v?.startsAt ?? initial.startsAt} required />
      </label>
      <label className="field">
        Stänger (svensk tid)
        <input name="endsAt" type="datetime-local" defaultValue={v?.endsAt ?? initial.endsAt} required />
      </label>
      {state?.error && (
        <p role="alert" className="error-text" style={{ gridColumn: "1 / -1", margin: 0 }}>{state.error}</p>
      )}
      <div style={{ gridColumn: "1 / -1" }}>
        <button type="submit" className="btn btn-primary" disabled={pending} style={{ padding: "10px 18px", fontSize: 14 }}>
          {pending ? "Sparar…" : pollId ? "Spara omgången" : "Skapa omgången"}
        </button>
      </div>
    </form>
  );
}
