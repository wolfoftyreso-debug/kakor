"use client";

import { useActionState } from "react";
import { saveArea } from "@/app/admin/actions";

export function AreaForm({
  areaId,
  name,
  weekdays,
  leadTimeDays,
  postalPrefixes,
  active,
}: {
  areaId: string;
  name: string;
  weekdays: string;
  leadTimeDays: number;
  postalPrefixes: string;
  active: boolean;
}) {
  const action = saveArea.bind(null, areaId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700 }}>{name}</div>
      <label className="field">
        Leveransdagar (1–7)
        <input name="weekdays" defaultValue={weekdays} placeholder="2,4" required />
      </label>
      <label className="field">
        Framförhållning (dagar)
        <input name="leadTimeDays" type="number" min="0" max="30" defaultValue={leadTimeDays} required />
      </label>
      <label className="field">
        Postnummerprefix (frivilligt)
        <input name="postalPrefixes" defaultValue={postalPrefixes} placeholder="135,136" />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="active" defaultChecked={active} />
        Aktivt leveransområde
      </label>
      {state?.error && (
        <div role="alert" className="error-text">
          {state.error}
        </div>
      )}
      <button type="submit" className="btn btn-outline" disabled={pending}>
        {pending ? "Sparar…" : "Spara"}
      </button>
    </form>
  );
}
