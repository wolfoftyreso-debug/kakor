"use client";

/** Skriv ut aktuell vy (körlista, följesedel). Utskriftsstilar ligger i globals.css. */
export function PrintButton({ label = "Skriv ut" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-outline no-print" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => window.print()}>
      {label}
    </button>
  );
}
