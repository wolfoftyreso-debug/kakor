import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { graph, webPageNode } from "@/lib/seo/schema";
import { Steps } from "@/components/Steps";
import { TrustStrip } from "@/components/TrustStrip";

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
    title: "Välj kakor och mängd",
    text: "Samma sortiment och samma varukorg som vanliga beställningar — blanda fritt.",
  },
  {
    title: "Välj hur ofta",
    text: "Varje vecka, varannan vecka eller var fjärde vecka. Ni väljer också första leveransdag.",
  },
  {
    title: "Fikat sköter sig självt",
    text: "Inför varje leverans skapas en vanlig order med faktura som mejlas till er. Ingen bindningstid — svara på bekräftelsemejlet så pausar eller avslutar vi.",
  },
];

export default async function PrenumerationPage() {
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
      <section className="section-y" style={{ background: "var(--section-tint)", padding: "var(--section-y) 24px", textAlign: "center" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Fikaprenumeration
        </div>
        <h1 className="h-display" style={{ marginBottom: 14 }}>
          Fika som bara dyker upp.
        </h1>
        <p className="lede" style={{ margin: "0 auto", maxWidth: "52ch" }}>
          Välj kakor, mängd och hur ofta — så står fikat på plats utan att någon behöver komma ihåg
          det. Det är en vanlig beställning som kommer igen automatiskt, inget mer.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/bestall?typ=aterkommande" className="btn btn-primary btn-lg">
            Välj kakor
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link href="/bestall?typ=engang" style={{ fontWeight: 600 }}>
            Vill ni bara beställa en gång? Samma väg — välj engångsbeställning i kassan.
          </Link>
        </p>
      </section>
      <TrustStrip band />

      <section className="container-medium" style={{ padding: "56px 24px 72px" }}>
        <h2 className="h-section" style={{ marginBottom: 28 }}>Så funkar det</h2>
        <Steps items={STEPS} />
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
