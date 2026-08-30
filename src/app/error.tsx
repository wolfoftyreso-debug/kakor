"use client";

// Feldsida för serverfel (t.ex. databas onåbar): utan denna visar Next en
// rå vit "Application error"-sida. Renderas inuti rotlayouten, så
// designsystemets klasser och typsnitt finns tillgängliga.

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Serverfelet är redan fångat server-side (Sentry/loggar) — detta är
    // bara för lokal felsökning i webbläsaren.
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        gap: 16,
      }}
    >
      <svg width="64" height="64" viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="90" r="82" fill="none" stroke="var(--text)" strokeWidth="9" />
        <text
          x="90"
          y="122"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-serif)", fontSize: 96, fontWeight: 700, fill: "var(--text)" }}
        >
          S
        </text>
      </svg>
      <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", lineHeight: 1.15 }}>
        Något gick fel hos oss
      </h1>
      <p style={{ margin: 0, maxWidth: "48ch", fontSize: 15.5, lineHeight: 1.65, color: "var(--text-2)" }}>
        Ett tillfälligt tekniskt fel gjorde att sidan inte kunde visas. Ingen beställning har
        skapats. Prova igen om en liten stund.
      </p>
      {error.digest && (
        <p className="mono" style={{ margin: 0, fontSize: 12, color: "var(--text-2)" }}>
          Referens: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
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
