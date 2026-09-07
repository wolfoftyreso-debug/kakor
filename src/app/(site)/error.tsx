"use client";

// Felgräns för publika sidor: renderas INUTI sajtlayouten så att sidhuvud
// och sidfot finns kvar och besökaren kan navigera vidare.

import { useEffect } from "react";
import Link from "next/link";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-narrow" style={{ padding: "64px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", lineHeight: 1.15 }}>Något gick fel hos oss</h1>
      <p style={{ maxWidth: "48ch", margin: "12px auto 0", fontSize: 15.5, lineHeight: 1.65, color: "var(--text-2)" }}>
        Ett tillfälligt tekniskt fel gjorde att sidan inte kunde visas. Ingen beställning har skapats. Prova igen om en liten stund.
      </p>
      {error.digest && (
        <p className="mono" style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-2)" }}>
          Referens: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Försök igen
        </button>
        <Link href="/" className="btn btn-outline">
          Till startsidan
        </Link>
      </div>
    </div>
  );
}
