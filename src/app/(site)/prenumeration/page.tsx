import type { Metadata } from "next";
import { ImageSlot } from "@/components/ImageSlot";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Steps } from "@/components/Steps";
import { TrustStrip } from "@/components/TrustStrip";
import { FaqList } from "@/components/FaqList";
import { CONTENT_DATES } from "@/lib/seo/content-dates";

// Fikaprenumerationen är INTE en egen butik eller checkout – det är ett
// köpläge i sajtens enda beställningsflöde (/bestall). Den här sidan
// förklarar hur det funkar och skickar in kunden i funneln med
// återkommande leverans förvald.

export const metadata: Metadata = {
  title: "Fikaprenumeration till jobbet, varje vecka",
  description:
    "Fikaprenumeration för företag: veckoleverans av kolasnittar, mandelkubb och chokladsnittar. Varje, varannan eller var fjärde vecka. Faktura, ingen bindning.",
  alternates: { canonical: "/prenumeration" },
  ...sharePreview({
    title: "Fikaprenumeration till jobbet, varje vecka",
    description:
      "Fikaprenumeration för företag: veckoleverans av kolasnittar, mandelkubb och chokladsnittar. Varje, varannan eller var fjärde vecka. Faktura, ingen bindning.",
    path: "/prenumeration",
    image: { url: "/images/prenumeration.jpg", alt: "Fat med chokladsnittar till fikaprenumerationen" },
  }),
};

const STEPS = [
  {
    title: "Välj kakor och mängd",
    text: "Samma sortiment och samma varukorg som vanliga beställningar – blanda fritt.",
  },
  {
    title: "Välj hur ofta",
    text: "Varje vecka, varannan vecka eller var fjärde vecka. Ni väljer också första leveransdag.",
  },
  {
    title: "Fikat sköter sig självt",
    text: "Inför varje leverans skapas en vanlig order med faktura som mejlas till er. Ingen bindningstid – svara på bekräftelsemejlet så pausar eller avslutar vi.",
  },
];

// Semrush (se): "fredagsfika" 320, "fredagsfika på jobbet" 110, "fika på jobbet" 210.
const PREN_FAQS = [
  {
    q: "Vad är en fikaprenumeration för företag?",
    a: "En återkommande beställning av småkakor till arbetsplatsen. Ni väljer sorter, mängd och intervall – varje, varannan eller var fjärde vecka – och kakorna kommer på områdets leveransdag utan att någon behöver lägga en ny order. Ingen bindningstid.",
  },
  {
    q: "Hur ofta kan vi få leverans?",
    a: "Varje vecka, varannan vecka eller var fjärde vecka, på ert områdes leveransdag. Ni väljer första leveransdag i kassan.",
  },
  {
    q: "Finns det bindningstid?",
    a: "Nej. Prenumerationen löper tills vidare och ni pausar, ändrar eller avslutar när ni vill. Ingen minimitid.",
  },
  {
    q: "Kan vi pausa en prenumeration?",
    a: "Ja. Använd den personliga länken i bekräftelsemejlet, eller svara på mejlet. En ändring efter att nästa order redan skapats gäller från leveransen därpå.",
  },
  {
    q: "Hur faktureras en fikaprenumeration?",
    a: "Inför varje leverans skapas en vanlig order med faktura som mejlas till er faktura-e-post. Förfallodagen räknas från leveransdagen. Inga kort, inga konton.",
  },
  {
    q: "Vilken dag kommer leveransen?",
    a: "På ert områdes fasta leveransdag, under dagen till en bemannad företagsadress. Kassan visar nästa lediga dag för Tyresö, Nacka, Haninge och Huddinge.",
  },
  {
    q: "Hur långt i förväg behöver vi beställa?",
    a: "Så snart datumet visas i kassan går det att boka som första leverans. Därefter sköter prenumerationen sig själv.",
  },
  {
    q: "Passar prenumerationen för fredagsfika?",
    a: "Ja – det är ett vanligt upplägg: en fast mängd varje eller varannan vecka så att fredagsfikat alltid finns på plats. Beställ gärna prova-på-paketet först för att se hur mycket som går åt hos er.",
  },
  {
    q: "Vad är skillnaden mot att beställa fika från en catering?",
    a: "Catering är oftast ett tillfälle: bullar, bakelser och leverans samma dag i innerstan. En fikaprenumeration hos oss är veckoleverans av samma småkakor per kilo, till Tyresö, Nacka, Haninge och Huddinge, mot faktura. Ingen ny meny att välja, ingen bindningstid.",
  },
];

const PREN_CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Fikaprenumeration", path: "/prenumeration" },
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
            breadcrumbs: PREN_CRUMBS,
            dateModified: CONTENT_DATES["/prenumeration"].updated,
          }),
          breadcrumbNode("/prenumeration", PREN_CRUMBS),
          faqNode("/prenumeration", PREN_FAQS)
        )}
      />
      <Breadcrumbs crumbs={PREN_CRUMBS} />
      <section className="section-y" style={{ background: "var(--section-tint)", padding: "var(--section-y) 24px", textAlign: "center" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Återkommande leverans
        </div>
        {/* H1 bär sidans sökintention (fikaprenumeration) – slogan som andra led. */}
        <h1 className="h-display" style={{ marginBottom: 14 }}>
          Fikaprenumeration till jobbet – fika som bara dyker upp.
        </h1>
        <p className="lede" style={{ margin: "0 auto", maxWidth: "52ch" }}>
          Välj kakor, mängd och hur ofta – så står fikat på plats utan att någon behöver komma ihåg
          det. Det är en vanlig beställning som kommer igen automatiskt, inget mer.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 26, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/bestall?typ=aterkommande" className="btn btn-primary btn-lg">
            Välj kakor
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link href="/bestall?typ=engang" style={{ fontWeight: 600 }}>
            Vill ni bara beställa en gång? Samma väg – välj engångsbeställning i kassan.
          </Link>
        </p>
      </section>
      <figure className="container-medium" style={{ margin: "0 auto", padding: "0 24px" }}>
        <div className="media" style={{ position: "relative", minHeight: 280, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)" }}>
          <ImageSlot label="Fat med chokladsnittar till fikaprenumerationen" src="/images/prenumeration.jpg" priority sizes="(max-width: 980px) 100vw, 980px" />
        </div>
      </figure>
      <TrustStrip band />

      <section className="container-medium" style={{ padding: "56px 24px 72px" }}>
        <h2 className="h-section" style={{ marginBottom: 28 }}>Så fungerar det</h2>
        <Steps items={STEPS} />
        <div className="info-box-muted" style={{ marginTop: 36, fontSize: "14.5px", lineHeight: 1.7 }}>
          <strong>Betalning mot faktura, precis som vanligt.</strong> Ingen kortdebitering och inget
          konto – varje leverans faktureras för sig, till den faktura-e-post ni anger.
        </div>
        <h2 className="h-section" style={{ marginTop: 48, marginBottom: 16 }}>
          Veckoleverans av fika – inte catering varje gång
        </h2>
        <p style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--brown-2)", maxWidth: "65ch" }}>
          En fikaprenumeration för företag är återkommande kakor till kontoret: samma mängd kolasnittar,
          mandelkubb eller chokladsnittar varje, varannan eller var fjärde vecka. Det är inte en
          cateringplattform med ny meny varje gång och inte ett kontorsabonnemang på kaffeautomater.
          Ni väljer kakorna en gång, vi levererar på områdets fasta dag i Tyresö, Nacka, Haninge eller
          Huddinge, och fakturan kommer per leverans. Ingen bindningstid.
        </p>
        <FaqList heading="Vanliga frågor om fikaprenumerationen" items={PREN_FAQS} />
        <p style={{ marginTop: 20, fontSize: 14.5 }}>
          Hur mycket ska ni beställa?{" "}
          <Link href="/fika-till-jobbet" style={{ fontWeight: 600 }}>
            Guide: fika till jobbet
          </Link>
          {" · "}
          <Link href="/vanliga-fragor" style={{ fontWeight: 600 }}>
            Alla vanliga frågor
          </Link>
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
