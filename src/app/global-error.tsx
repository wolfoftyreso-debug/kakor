"use client";

// Sista skyddsnätet: fel i själva rotlayouten. Renderas UTAN layout/CSS,
// så allt stylas inline med designsystemets färger hårdkodade.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 16,
          padding: 24,
          background: "#faf5ea",
          color: "#3b281b",
          fontFamily: "Georgia, serif",
        }}
      >
        <h1 style={{ fontSize: 32, margin: 0 }}>Något gick fel hos oss</h1>
        <p style={{ margin: 0, maxWidth: "48ch", lineHeight: 1.6, color: "#7a614d" }}>
          Ett tillfälligt tekniskt fel gjorde att sidan inte kunde visas. Prova igen om en liten
          stund.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 12, color: "#7a614d", fontFamily: "monospace" }}>
            Referens: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#3b281b",
            color: "#faf5ea",
            border: "none",
            borderRadius: 6,
            padding: "14px 26px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Försök igen
        </button>
        {/* global-error ersätter hela root-layouten — next/link är inte tillgängligt här. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ color: "#a03d2c", fontWeight: 700, display: "block", marginTop: 16 }}>
          Till startsidan
        </a>
      </body>
    </html>
  );
}
