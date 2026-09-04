import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { faqNode, graph, webPageNode } from "@/lib/seo/schema";
import { Steps } from "@/components/Steps";
import { TrustStrip } from "@/components/TrustStrip";
import { FaqList } from "@/components/FaqList";

// Fikaprenumerationen är INTE en egen butik eller checkout — det är ett
// köpläge i sajtens enda beställningsflöde (/bestall). Den här sidan
// förklarar hur det funkar och skickar in kunden i funneln med
// återkommande leverans förvald.

export const metadata: Metadata = {
  title: "Fikaprenumeration till jobbet, varje vecka",
  description:
    "Fikaprenumeration för företag: kolasnittar, mandelkubb och chokladsnittar varje, varannan eller var fjärde vecka. Faktura per leverans, ingen bindningstid.",
  alternates: { canonical: "/prenumeration" },
  ...sharePreview({
    title: "Fikaprenumeration till jobbet, varje vecka",
    description:
      "Fikaprenumeration för företag: kolasnittar, mandelkubb och chokladsnittar varje, varannan eller var fjärde vecka. Faktura per leverans, ingen bindningstid.",
    path: "/prenumeration",
    image: { url: "/images/prenumeration.jpg", alt: "Fat med chokladsnittar till fikaprenumerationen" },
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

// Semrush (se): "fredagsfika" 320, "fredagsfika på jobbet" 110, "fika på jobbet" 210.
const PREN_FAQS = [
  {
    q: "Hur ofta kan vi få leverans?",
    a: "Varje vecka, varannan vecka eller var fjärde vecka, på ert områdes leveransdag. Ni väljer första leveransdag i kassan.",
  },
  {
    q: "Finns det bindningstid?",
    a: "Nej. Prenumerationen löper tills vidare och ni pausar, ändrar eller avslutar när ni vill genom att svara på bekräftelsemejlet. En ändring som meddelas efter att nästa order redan skapats gäller från leveransen därpå.",
  },
  {
    q: "Hur faktureras en fikaprenumeration?",
    a: "Inför varje leverans skapas en vanlig order med faktura som mejlas till er faktura-e-post. Förfallodagen räknas från leveransdagen. Inga kort, inga konton.",
  },
  {
    q: "Passar prenumerationen för fredagsfika?",
    a: "Ja — det är det vanligaste upplägget: en fast mängd varje eller varannan vecka så att fredagsfikat alltid finns på plats. Beställ gärna prova-på-paketet först för att se hur mycket som går åt hos er.",
  },
];

export default async function PrenumerationPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path: "/prenumeration",
            title: "Fikaprenumeration till jobbet, varje vecka",
            description: String(metadata.description),
          }),
          faqNode("/prenumeration", PREN_FAQS)
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
        <FaqList heading="Vanliga frågor om fikaprenumerationen" items={PREN_FAQS} />
        <p style={{ marginTop: 20, fontSize: 14.5 }}>
          Hur mycket ska ni beställa? <Link href="/fika-till-jobbet" style={{ fontWeight: 600 }}>Guide: fika till jobbet</Link>
        </p>
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/bestall?typ=aterkommande" className="btn btn-primary btn-lg">
            Välj kakor
          </Link>
        </div>
      </section>
    </>
  );
}
