import type { Metadata } from "next";
import Link from "next/link";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { ImageSlot } from "@/components/ImageSlot";
import { fromISODate, weekdayName, isoWeekday } from "@/lib/dates";
import { siteConfig } from "@/lib/config";
import { JsonLd } from "@/components/JsonLd";
import { graph, productListNode, productNode, webPageNode } from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sockerbagaren — Riktigt fika till jobbet",
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
  { n: "1", title: "Välj kakor", desc: "Blanda sorter och vikter som det passar er." },
  { n: "2", title: "Välj leveransdag", desc: "Vi visar tillgängliga leveransdagar för ert område." },
  { n: "3", title: "Vi kör ut", desc: "Leverans under dagen till er bemannade adress." },
  { n: "4", title: "Ni får faktura", desc: "Ingen kortbetalning — fakturan kommer efteråt." },
];

const INGREDIENTS: { name: string; src?: string }[] = [
  { name: "Riktigt smör", src: "/images/smor.jpg" },
  { name: "Strösocker", src: "/images/socker.jpg" },
  { name: "Vetemjöl", src: "/images/vetemjol.jpg" },
  { name: "Mandel", src: "/images/mandel.jpg" },
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
  { q: "Kan vi blanda olika kakor?", a: "Ja — lägg flera sorter i samma order och välj vikt per sort." },
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
      <section
        style={{ background: "var(--section-tint)" }}
        className="hero-grid"
      >
        <div className="hero-copy">
          <div className="eyebrow">Lokalt bageri · Södra Stockholm</div>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.08, letterSpacing: "-0.5px" }}>
            Riktigt fika till jobbet.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, margin: 0, maxWidth: "44ch", color: "var(--brown-2)" }}>
            Klassiska småkakor bakade på riktigt smör och riktiga råvaror — levererade direkt till
            företag i Tyresö, Nacka, Haninge och Huddinge.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
            <Link href="/bestall" className="btn btn-primary btn-lg">
              Beställ kakor
            </Link>
            <Link href="/prenumeration" className="btn btn-butter btn-lg">
              Starta fikaprenumeration
            </Link>
          </div>
          <div style={{ fontSize: "13.5px", color: "var(--text-2)" }}>
            Betalning mot faktura · Leverans på fasta leveransdagar
          </div>
        </div>
        <div style={{ minHeight: 320 }}>
          <ImageSlot
            label="Fat med chokladsnittar, mandelkubb och kolasnittar bredvid en kopp kaffe"
            src="/images/hero.jpg"
            priority
          />
        </div>
      </section>

      {/* PRODUKTER */}
      <section id="kakor" className="container" style={{ padding: "64px 48px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)" }}>Våra kakor</h2>
          <div style={{ fontSize: 14, color: "var(--text-2)" }}>
            Säljs per kilo · blanda fritt i samma order ·{" "}
            <Link href="/kakor" style={{ fontWeight: 700 }}>
              Alla kakor →
            </Link>
          </div>
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
          className="container two-col"
          style={{ padding: "64px 48px", display: "grid", gap: 48, alignItems: "center" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.15 }}>Smör ska smaka smör.</h2>
            <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, maxWidth: "48ch", color: "var(--brown-2)" }}>
              Våra kakor bakas på riktigt smör, vanligt strösocker och kvalitativa traditionella
              råvaror. Inga onödiga tillsatser, inga genvägar för att få industrikakor att likna
              hembakat.
            </p>
            <Link href="/ingredienser" style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
              Vad finns egentligen i våra kakor? →
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 14,
            }}
          >
            {INGREDIENTS.map(({ name, src }) => (
              <div
                key={name}
                style={{
                  background: "var(--bg)",
                  borderRadius: 8,
                  padding: "18px 12px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden" }}>
                  <ImageSlot label={name} src={src} circle />
                </div>
                <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SÅ FUNGERAR DET */}
      <section className="container" style={{ padding: "64px 48px" }}>
        <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)", marginBottom: 32 }}>Så fungerar det</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
              <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRENUMERATION */}
      <section style={{ background: "var(--text)", color: "var(--bg)" }}>
        <div
          className="container two-col"
          style={{ padding: "72px 48px", display: "grid", gap: 48, alignItems: "center" }}
        >
          <div style={{ minHeight: 300, borderRadius: 8, overflow: "hidden" }}>
            <ImageSlot
              label="Chokladsnittar med pärlsocker på ett kakfat"
              src="/images/prenumeration.jpg"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: "12.5px", fontWeight: 700, letterSpacing: "2.5px", color: "var(--butter)" }}>
              FIKAPRENUMERATION
            </div>
            <h2 style={{ fontSize: "clamp(26px, 3vw, 38px)", lineHeight: 1.12 }}>
              Fika som bara dyker upp.
            </h2>
            <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, maxWidth: "46ch", color: "var(--footer-text)" }}>
              Välj kakor, mängd och hur ofta — så står fikat på plats utan att någon behöver komma
              ihåg det. Pausa eller avsluta enkelt.
            </p>
            <div>
              <Link href="/prenumeration" className="btn btn-butter btn-lg">
                Starta fikaprenumeration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FÖR ARBETSPLATSER */}
      <section
        className="container two-col"
        style={{ padding: "64px 48px", display: "grid", gap: 48, alignItems: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)" }}>Fika för arbetsplatser</h2>
          <p style={{ fontSize: 16, lineHeight: 1.65, margin: 0, maxWidth: "50ch", color: "var(--brown-2)" }}>
            Kontor, verkstäder, byggföretag, kliniker och butiker — alla arbetsplatser där personal
            och besökare fikar. Beställ till fredagsfikat, mötet eller personalrummet. Ni får
            faktura, vi sköter resten.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 2, color: "var(--brown-2)" }}>
            <li>Betalning mot faktura — inga kort</li>
            <li>Snabbeställning för återkommande kunder</li>
            <li>Leverans under dagen till bemannad adress</li>
          </ul>
        </div>
        <div style={{ minHeight: 280, borderRadius: 8, overflow: "hidden" }}>
          <ImageSlot label="Kolasnittar på ett fat bredvid en kopp kaffe" src="/images/fika.jpg" />
        </div>
      </section>

      {/* OMRÅDEN */}
      <section style={{ background: "var(--section-tint)" }}>
        <div className="container" style={{ padding: "64px 48px" }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)", marginBottom: 8 }}>
            Lokal leverans i södra Stockholm
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 28px" }}>
            Vi kör själva, på fasta leveransdagar per område.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {areas.map((a) => (
              <Link
                key={a.slug}
                href={`/${a.slug}`}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "var(--text)",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: "13.5px", color: "var(--text-2)" }}>
                  Leveransdag:{" "}
                  {a.upcomingDates[0]
                    ? weekdayName(isoWeekday(fromISODate(a.upcomingDates[0])))
                    : a.weekdays.map(weekdayName).join(" & ")}
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--red)", marginTop: 6 }}>
                  Kakor till företag i {a.name} →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-narrow" style={{ padding: "64px 24px" }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 30px)", marginBottom: 24 }}>Vanliga frågor</h2>
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
      <section style={{ background: "var(--butter)", padding: "72px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)" }}>Ska vi ordna nästa fika?</h2>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/bestall" className="btn btn-primary btn-lg">
              Beställ kakor
            </Link>
            <Link href="/prenumeration" className="btn btn-cream btn-lg">
              Starta fikaprenumeration
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
