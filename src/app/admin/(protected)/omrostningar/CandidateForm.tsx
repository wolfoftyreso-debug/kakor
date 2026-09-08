"use client";

import { useActionState } from "react";
import { saveCandidate } from "@/app/admin/poll-actions";

export function CandidateForm({
  pollId,
  candidateId,
  initial,
}: {
  pollId: string;
  candidateId: string | null;
  initial: { name: string; slug: string; description: string; tradition: string; imageRef: string; displayOrder: number; sourceReference: string };
}) {
  const action = saveCandidate.bind(null, pollId, candidateId);
  const [state, formAction, pending] = useActionState(action, null);
  const v = state?.values;
  return (
    <form action={formAction} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
      <label className="field">
        Namn
        <input name="name" defaultValue={v?.name ?? initial.name} required />
      </label>
      <label className="field">
        Slug
        <input name="slug" defaultValue={v?.slug ?? initial.slug} required />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Kort beskrivning (en mening)
        <input name="description" defaultValue={v?.description ?? initial.description} maxLength={300} />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Plats i fikatraditionen (kort)
        <input name="tradition" defaultValue={v?.tradition ?? initial.tradition} maxLength={200} />
      </label>
      <label className="field">
        Bild (sökväg i /public, t.ex. /images/hallongrotta.jpg)
        <input name="imageRef" defaultValue={v?.imageRef ?? initial.imageRef} />
      </label>
      <label className="field">
        Ordning
        <input name="displayOrder" type="number" min={0} max={99} defaultValue={v?.displayOrder ?? initial.displayOrder} />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Källa i boken (frivilligt, t.ex. sida)
        <input name="sourceReference" defaultValue={v?.sourceReference ?? initial.sourceReference} />
      </label>
      {state?.error && (
        <p role="alert" className="error-text" style={{ gridColumn: "1 / -1", margin: 0 }}>{state.error}</p>
      )}
      <div style={{ gridColumn: "1 / -1" }}>
        <button type="submit" className="btn btn-outline" disabled={pending} style={{ padding: "8px 14px", fontSize: 13.5 }}>
          {pending ? "Sparar…" : candidateId ? "Spara kandidaten" : "Lägg till kandidat"}
        </button>
      </div>
    </form>
  );
}
