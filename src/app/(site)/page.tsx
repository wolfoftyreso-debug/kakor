import type { Metadata } from "next";
import Link from "next/link";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { ImageSlot } from "@/components/ImageSlot";
import { TrustStrip } from "@/components/TrustStrip";
import { Steps } from "@/components/Steps";
import { IconCheck } from "@/components/Icons";
import { formatOre } from "@/lib/money";
import { priceSuffix } from "@/lib/units";
import { fromISODate, weekdayName, isoWeekday } from "@/lib/dates";
import { siteConfig } from "@/lib/config";
import { JsonLd } from "@/components/JsonLd";
import { graph, productListNode, productNode, webPageNode } from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Sockerbagaren — Riktigt fika till jobbet" },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sockerbagaren — Riktigt fika till jobbet",
    description: siteConfig.description,
    url: "/",
    siteName: "Sockerbagaren",
    locale: "sv_SE",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Sockerbagaren" }],
  },
};

const STEPS = [
  { title: "Välj kakor", text: "Blanda sorter och mängder som det passar er." },
  { title: "Välj leveransdag", text: "Vi visar tillgängliga leveransdagar för ert område." },
  { title: "Vi kör ut", text: "Leverans under dagen till er bemannade adress." },
  { title: "Ni får faktura", text: "Ingen kortbetalning — fakturan skapas vid beställningen och mejlas." },
];

const INGREDIENTS: { name: string; src?: string }[] = [
  { name: "Riktigt smör", src: "/images/smor.jpg" },
  { name: "Strösocker", src: "/images/socker.jpg" },
  { name: "Vetemjöl", src: "/images/vetemjol.jpg" },
  { name: "Mandel", src: "/images/mandel.jpg" },
  { name: "Mörk choklad", src: "/images/choklad.jpg" },
  { name: "Ägg från frigående höns", src: "/images/agg.jpg" },
];

const FAQS = [
  {
    q: "Hur betalar vi?",
    a: "All betalning sker mot faktura. Ni skickar beställningen, vi levererar och fakturan kommer till er faktura-e-post.",
  },
  {
    q: "Vart levererar ni?",
    a: "Vi kör lokal leverans till företag i Tyresö, Nacka, Haninge och Huddinge — fler områden tillkommer.",
  },
  {
    q: "När kommer leveransen?",
    a: "Vi levererar under dagen på områdets leveransdag, till bemannade företagsadresser. Se till att någon kan ta emot leveransen.",
  },
  { q: "Kan vi blanda olika kakor?", a: "Ja — lägg flera sorter i samma order och välj mängd per sort." },
  {
    q: "Hur funkar fikaprenumerationen?",
    a: "Ni väljer kakor, mängd och intervall. Leveransen kommer på er leveransdag, och ni kan pausa eller avsluta enkelt.",
  },
  {
    q: "Vad innehåller kakorna?",
    a: "Riktigt smör, vetemjöl, strösocker och traditionella råvaror. Fullständiga ingredienser och allergener finns på varje produkt.",
  },
];

export default async function HomePage() {
  const [products, areas] = await Promise.all([getActiveProducts(), getAreasWithDates(1)]);
  // Flytande kortet på hero-bilden visar produkten med etikett (t.ex. Bästsäljare)
  // — eller första produkten om ingen etikett satts i admin.
  const featured = products.find((p) => p.badge) ?? products[0];

  // Sidgraf från schema-motorn: WebPage + produktlista + produktentiteter
  // (Organization/WebSite ligger i layouten och refereras via @id).
  const pageGraph = graph(
    webPageNode({
      path: "/",
      title: "Sockerbagaren — Riktigt fika till jobbet",
      description: siteConfig.description,
      mainEntityId: `${siteConfig.url.replace(/\/$/, "")}/#products`,
    }),
    productListNode("/", products),
    ...products.map(productNode)
  );

  return (
    <>
      <JsonLd data={pageGraph} />
      {/* HERO */}
      <section style={{ background: "var(--section-tint)" }} className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">Bakat med recept från Svenskt konditorlexikon 1957</div>
          <h1 className="h-display">Riktigt fika till jobbet.</h1>
          <p className="lede" style={{ margin: 0, maxWidth: "46ch" }}>
            Kolasnittar, mandelkubb och chokladsnittar bakade på riktigt smör — levererade
            direkt till företag i Tyresö, Nacka, Haninge och Huddinge.
          </p>
          <div className="hero-actions">
            <Link href="/bestall" className="btn btn-primary btn-lg">
              Beställ kakor
            </Link>
            <Link href="/bestall?typ=aterkommande" className="btn btn-butter btn-lg">
              Starta fikaprenumeration
            </Link>
          </div>
          <TrustStrip />
        </div>
        <div className="hero-media">
          <ImageSlot
            label="Fat med chokladsnittar, mandelkubb och kolasnittar bredvid en kopp kaffe"
            src="/images/hero.jpg"
            priority
          />
          {featured && (
            <Link href={`/kakor/${featured.slug}`} className="hero-float">
              <span className="hero-float-img">
                <ImageSlot label={featured.name} src={featured.imageRef || undefined} />
              </span>
              <span>
                {featured.badge && <span className="hero-float-badge">{featured.badge}</span>}
                <span className="hero-float-name" style={{ display: "block" }}>{featured.name}</span>
                <span className="hero-float-price">
                  {formatOre(featured.pricePerKgOre)}
                  {priceSuffix(featured.unit)} exkl. moms
                </span>
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* PRODUKTER */}
      <section id="kakor" className="container section-y">
        <div className="section-head">
          <div>
            <h2 className="h-section">Våra kakor</h2>
            <p>Säljs per kilo — blanda fritt i samma order.</p>
          </div>
          <Link href="/kakor" className="section-link">
            Alla kakor →
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* SMÖR */}
      <section style={{ background: "var(--butter)" }}>
        <div
          className="container two-col section-y"
          style={{ display: "grid", gap: 48, alignItems: "center" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="eyebrow">Råvarorna</div>
            <h2 className="h-section">Smör ska smaka smör.</h2>
            <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, maxWidth: "48ch", color: "var(--brown-2)" }}>
              Våra kakor bakas på riktigt smör, vanligt strösocker och kvalitativa traditionella
              råvaror. Inga onödiga tillsatser, inga genvägar för att få industrikakor att likna
              hembakat.
            </p>
            <Link href="/ingredienser" className="section-link" style={{ alignSelf: "flex-start", borderColor: "var(--text)" }}>
              Vad finns egentligen i våra kakor? →
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              // Sex råvaror: fasta 3 kolumner ger jämna 2 rader på alla bredder.
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
            }}
          >
            {INGREDIENTS.map(({ name, src }) => (
              <Link key={name} href="/ingredienser" className="ingredient-tile">
                <span className="tile-img">
                  <ImageSlot label={name} src={src} circle />
                </span>
                <span className="tile-name">{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SÅ FUNGERAR DET */}
      <section className="container section-y">
        <div className="section-head">
          <div>
            <h2 className="h-section">Så fungerar det</h2>
            <p>Fyra steg — inga konton, inga kort.</p>
          </div>
        </div>
        <Steps items={STEPS} />
      </section>

      {/* PRENUMERATION */}
      <section style={{ background: "var(--text)", color: "var(--bg)" }}>
        <div
          className="container two-col section-y"
          style={{ display: "grid", gap: 48, alignItems: "center" }}
        >
          <div style={{ minHeight: 300, borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
            <ImageSlot
              label="Chokladsnittar med pärlsocker på ett kakfat"
              src="/images/prenumeration.jpg"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="eyebrow" style={{ color: "var(--butter)" }}>
              Fikaprenumeration
            </div>
            <h2 className="h-section">Fika som bara dyker upp.</h2>
            <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, maxWidth: "46ch", color: "var(--footer-text)" }}>
              Välj kakor, mängd och hur ofta — så står fikat på plats utan att någon behöver komma
              ihåg det. Pausa eller avsluta enkelt.
            </p>
            <div>
              <Link href="/bestall?typ=aterkommande" className="btn btn-butter btn-lg">
                Starta fikaprenumeration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FÖR ARBETSPLATSER */}
      <section
        className="container two-col section-y"
        style={{ display: "grid", gap: 48, alignItems: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="eyebrow">Företagsfika</div>
          <h2 className="h-section">Fika för arbetsplatser</h2>
          <p style={{ fontSize: 16, lineHeight: 1.65, margin: 0, maxWidth: "50ch", color: "var(--brown-2)" }}>
            Kontor, verkstäder, byggföretag, kliniker och butiker — alla arbetsplatser där personal
            och besökare fikar. Beställ till fredagsfikat, mötet eller personalrummet. Ni får
            faktura, vi sköter resten.
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 15, color: "var(--brown-2)" }}>
            {[
              "Betalning mot faktura — inga kort",
              "Snabbeställning för återkommande kunder",
              "Leverans under dagen till bemannad adress",
            ].map((t) => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--red)", display: "inline-flex" }}>
                  <IconCheck />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ minHeight: 280, maxHeight: 420, borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
          <ImageSlot
            label="Kollegor fikar med småkakor och kaffe vid ett bord i verkstaden"
            src="/images/arbetsplatsfika.jpg"
          />
        </div>
      </section>

      {/* OMRÅDEN */}
      <section style={{ background: "var(--section-tint)" }}>
        <div className="container section-y">
          <div className="section-head">
            <div>
              <h2 className="h-section">Lokal leverans i södra Stockholm</h2>
              <p>Vi kör själva, på fasta leveransdagar per område.</p>
            </div>
            <Link href="/leverans" className="section-link">
              Om leveransen →
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {areas.map((a) => (
              <Link key={a.slug} href={`/${a.slug}`} className="card card-hover area-card">
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: "13.5px", color: "var(--text-2)" }}>
                  Leveransdag:{" "}
                  {a.upcomingDates[0]
                    ? weekdayName(isoWeekday(fromISODate(a.upcomingDates[0])))
                    : a.weekdays.map(weekdayName).join(" & ")}
                </div>
                <span className="area-cta">Kakor till företag i {a.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-narrow section-y">
        <h2 className="h-section" style={{ marginBottom: 24 }}>Vanliga frågor</h2>
        <div>
          {FAQS.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>{f.q}</summary>
              <div className="faq-answer">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <h2 className="h-section" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>Ska vi ordna nästa fika?</h2>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/bestall" className="btn btn-primary btn-lg">
              Beställ kakor
            </Link>
            <Link href="/bestall?typ=aterkommande" className="btn btn-cream btn-lg">
              Starta fikaprenumeration
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
