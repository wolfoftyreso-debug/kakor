import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { graph, webPageNode } from "@/lib/seo/schema";

// Fikaprenumerationen är INTE en egen butik eller checkout — det är ett
// köpläge i sajtens enda beställningsflöde (/bestall). Den här sidan
// förklarar hur det funkar och skickar in kunden i funneln med
// återkommande leverans förvald.

export const metadata: Metadata = {
  title: "Fikaprenumeration",
  description:
    "Fika som bara dyker upp: välj kakor, mängd och hur ofta — vi levererar på er leveransdag och fakturerar efteråt. Pausa eller avsluta enkelt.",
  alternates: { canonical: "/prenumeration" },
  ...sharePreview({
    title: "Fikaprenumeration",
    description:
      "Fika som bara dyker upp: välj kakor, mängd och hur ofta — vi levererar på er leveransdag och fakturerar efteråt. Pausa eller avsluta enkelt.",
    path: "/prenumeration",
  }),
};

const STEPS = [
  {
    n: "1",
    title: "Välj kakor och mängd",
    text: "Samma sortiment och samma varukorg som vanliga beställningar — blanda fritt.",
  },
  {
    n: "2",
    title: "Välj hur ofta",
    text: "Varje vecka, varannan vecka eller var fjärde vecka. Ni väljer också första leveransdag.",
  },
  {
    n: "3",
    title: "Fikat sköter sig självt",
    text: "Inför varje leverans skapas en vanlig order med faktura som mejlas till er. Ingen bindningstid — pausa eller avsluta när ni vill.",
  },
];

export default function PrenumerationPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path: "/prenumeration",
            title: "Fikaprenumeration",
            description: String(metadata.description),
          })
        )}
      />
      <section style={{ background: "var(--section-tint)", padding: "56px 24px", textAlign: "center" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Fikaprenumeration
        </div>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", letterSpacing: "-0.5px", marginBottom: 12 }}>
          Fika som bara dyker upp.
        </h1>
        <p style={{ fontSize: 17, color: "var(--brown-2)", margin: "0 auto", maxWidth: "52ch", lineHeight: 1.6 }}>
          Välj kakor, mängd och hur ofta — så står fikat på plats utan att någon behöver komma ihåg
          det. Det är en vanlig beställning som kommer igen automatiskt, inget mer.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/bestall?typ=aterkommande" className="btn btn-primary btn-lg">
            Välj kakor
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link href="/bestall" style={{ fontWeight: 600 }}>
            Vill ni bara beställa en gång? Samma väg — välj engångsbeställning i kassan.
          </Link>
        </p>
      </section>

      <section className="container-medium" style={{ padding: "56px 24px 72px" }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 30px)", marginBottom: 28 }}>Så funkar det</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24,
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              style={{
                borderTop: "2px solid var(--text)",
                paddingTop: 18,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 700, color: "var(--red)" }}>
                {s.n}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}>{s.text}</div>
            </div>
          ))}
        </div>
        <div className="info-box-muted" style={{ marginTop: 36, fontSize: "14.5px", lineHeight: 1.7 }}>
          <strong>Betalning mot faktura, precis som vanligt.</strong> Ingen kortdebitering och inget
          konto — varje leverans faktureras för sig, till den fakturaadress ni anger.
        </div>
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/bestall?typ=aterkommande" className="btn btn-primary btn-lg">
            Välj kakor
          </Link>
        </div>
      </section>
    </>
  );
}
