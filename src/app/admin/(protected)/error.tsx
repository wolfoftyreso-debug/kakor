"use client";

// Felgräns för admin: egen text (ingen kundtext om beställningar) och
// tydligt besked om att ingen ändring sparats.

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div style={{ padding: "40px 0", maxWidth: 560 }}>
      <h1 style={{ fontSize: 24, marginBottom: 10 }}>Något gick fel</h1>
      <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
        Sidan kunde inte visas. Ingen ändring har sparats. Ladda om sidan eller försök igen om en stund.
      </p>
      {error.digest && (
        <p className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
          Referens: {error.digest}
        </p>
      )}
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={reset}>
        Försök igen
      </button>
    </div>
  );
}
