import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Fakturalänken hittades inte", robots: { index: false, follow: false } };

// Landningssida för ogiltiga eller gamla fakturalänkar – i stället för en rå
// textrad utan sidhuvud. Ingen "kontakta oss": svaret på orderbekräftelsen räcker.
export default function InvoiceMissingPage() {
  return (
    <div className="container-narrow" style={{ padding: "64px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", lineHeight: 1.15 }}>Fakturalänken hittades inte</h1>
      <p style={{ maxWidth: "48ch", margin: "12px auto 0", fontSize: 15.5, lineHeight: 1.65, color: "var(--text-2)" }}>
        Länken är ofullständig eller hör till en faktura som inte finns. Fakturan finns som PDF i
        mejlet med er orderbekräftelse – svara på det mejlet så skickar vi en ny länk.
      </p>
      <div style={{ marginTop: 22 }}>
        <Link href="/" className="btn btn-outline">
          Till startsidan
        </Link>
      </div>
    </div>
  );
}
