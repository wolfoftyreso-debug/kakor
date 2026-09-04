"use client";

import { useActionState, useState } from "react";
import { weekdayName } from "@/lib/dates";
import { saveArea } from "@/app/admin/actions";

export function AreaForm({
  areaId,
  name,
  weekdays,
  leadTimeDays,
  postalPrefixes,
  blockedDates,
  active,
}: {
  areaId: string;
  name: string;
  weekdays: string;
  leadTimeDays: number;
  postalPrefixes: string;
  /** Ett ISO-datum per rad. */
  blockedDates: string;
  active: boolean;
}) {
  const action = saveArea.bind(null, areaId);
  const [state, formAction, pending] = useActionState(action, null);
  const [weekdayInput, setWeekdayInput] = useState(weekdays);
  // Siffror är lätta att skriva fel — visa dagnamnen live så att "4" tydligt betyder torsdag.
  const weekdayLabels = weekdayInput
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((n) => n >= 1 && n <= 7)
    .map(weekdayName)
    .join(", ");

  return (
    <form action={formAction} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700 }}>{name}</div>
      <label className="field">
        Leveransdagar (1–7)
        <input
          name="weekdays"
          value={weekdayInput}
          onChange={(e) => setWeekdayInput(e.target.value)}
          placeholder="4"
          required
        />
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          {weekdayLabels ? `= ${weekdayLabels}` : "Ange veckodagar som siffror, t.ex. 4 för torsdag"}
        </span>
      </label>
      <label className="field">
        Framförhållning (dagar)
        <input name="leadTimeDays" type="number" min="0" max="30" defaultValue={leadTimeDays} required />
      </label>
      <label className="field">
        Postnummerprefix (frivilligt)
        <input name="postalPrefixes" defaultValue={postalPrefixes} placeholder="135,136" />
      </label>
      <label className="field">
        Spärrade datum för det här området (frivilligt)
        <textarea
          name="blockedDates"
          defaultValue={blockedDates}
          rows={3}
          placeholder={"2026-12-17\n2026-12-24"}
          style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}
        />
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          Ett datum per rad (ÅÅÅÅ-MM-DD). Helgdagar, midsommar-, jul- och nyårsafton är redan
          spärrade automatiskt. Passerade datum rensas när du sparar.
        </span>
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
      {state?.saved && (
        <div role="status" className="info-box" style={{ fontSize: 13.5 }}>
          {state.saved}
        </div>
      )}
      <button type="submit" className="btn btn-outline" disabled={pending}>
        {pending ? "Sparar…" : "Spara"}
      </button>
    </form>
  );
}
