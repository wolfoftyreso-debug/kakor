import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { getActiveProducts } from "@/lib/products";
import { FaqList } from "@/components/FaqList";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, productListNode, productNode, webPageNode } from "@/lib/seo/schema";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

// Titel/description breddade mot kategorins verkliga sökfält (Semrush se):
// "småkakor" 8 100 sök/mån, "fikabröd" 1 600, "kaffebröd" 590.
// Semrush (se): "gammaldags småkakor" 1 600 (KD 19), "smörkakor" 1 900 (KD 18),
// "småkakor" 8 100, "fikabröd" 1 600, "kaffebröd" 590, "kakor" 14 800.
const PAGE_TITLE = "Gammaldags småkakor på riktigt smör";
const PAGE_DESCRIPTION =
  "Gammaldags småkakor på recept från 1957: kolasnittar, mandelkubb och chokladsnittar på riktigt smör. Per kilo till företag i södra Stockholm, mot faktura.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/kakor" },
  ...sharePreview({ title: PAGE_TITLE, description: PAGE_DESCRIPTION, path: "/kakor" }),
};

// Renderas synligt längst ner på sidan + som FAQPage-schema (samma text).
// Svaren är generell bakkunskap — inga verksamhetslöften.
const KAKOR_FAQS = [
  {
    q: "Hur förvarar man småkakor bäst?",
    a: "I en tät burk i rumstemperatur, gärna med bakplåtspapper mellan lagren. Undvik kylskåp — kakor tar lätt smak och mister sin konsistens i kyla.",
  },
  {
    q: "Hur länge håller kakor i rumstemperatur?",
    a: "Småkakor på riktigt smör håller sig fina i flera veckor i en tät burk i rumstemperatur. Öppna burken så lite som möjligt och lägg bakplåtspapper mellan lagren, så behåller de både smak och konsistens.",
  },
  {
    q: "Hur länge håller kakor i frysen?",
    a: "Småkakor tål frysning mycket bra. Frys i tät påse eller burk och låt tina i rumstemperatur — konsistens och smak håller sig i flera månader.",
  },
  {
    q: "Vilka är sju sorters kakor?",
    a: "En klassisk svensk kaffebjudningstradition: minst sju olika småkakor på bordet. Mandelkubb, kolasnittar och chokladsnittar är tre av klassikerna som ofta ingår.",
  },
  {
    q: "Vad är gammaldags småkakor?",
    a: "Småkakor bakade som förr: på riktigt smör, socker, vetemjöl och ägg, utan margarin eller onödiga tillsatser. Våra tre sorter bakas efter recept ur Svenskt konditorlexikon från 1957.",
  },
  {
    q: "Hur mycket kakor går det åt per person?",
    a: "Räkna ungefär 3–5 småkakor per person till en fika. Hur många kakor ett kilo ger beror på sorten — snittar är lätta och mandelkubb tyngre — så välj gärna prova-på-paketet första gången och se hur långt det räcker hos er.",
  },
];

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Kakor", path: "/kakor" },
];

export default async function KakorPage() {
  const products = await getActiveProducts();

  const pageGraph = graph(
    webPageNode({
      path: "/kakor",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      breadcrumbs: CRUMBS,
      pageType: "CollectionPage",
      mainEntityId: `${siteConfig.url.replace(/\/$/, "")}/kakor#products`,
    }),
    breadcrumbNode("/kakor", CRUMBS),
    productListNode("/kakor", products),
    ...products.map(productNode),
    faqNode("/kakor", KAKOR_FAQS)
  );

  return (
    <>
      <JsonLd data={pageGraph} />
      <Breadcrumbs crumbs={CRUMBS} container="container" />
      {/* Full bredd så att alla fyra sorter ryms på en rad på desktop. */}
      <div className="container" style={{ paddingTop: 24, paddingBottom: 80 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)" }}>Gammaldags småkakor på riktigt smör</h1>
          <div style={{ fontSize: 14, color: "var(--text-2)" }}>
            Säljs per kilo eller paket · blanda fritt i samma order
          </div>
        </div>
        <p className="lede" style={{ margin: "0 0 28px" }}>
          Klassiska svenska smörkakor efter recept från Svenskt konditorlexikon 1957 — kolasnittar,
          mandelkubb och chokladsnittar bakade på riktigt smör, vanligt strösocker och kvalitativa
          traditionella råvaror. Kaffekakor och fikabröd per kilo till arbetsplatser i Tyresö, Nacka, Haninge och
          Huddinge — betalning sker alltid mot faktura.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 24,
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} headingLevel="h2" />
          ))}
        </div>
        <div style={{ marginTop: 32, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/bestall" className="btn btn-primary btn-lg">
            Beställ kakor
          </Link>
          <Link href="/bestall?typ=aterkommande" className="btn btn-butter btn-lg">
            Starta fikaprenumeration
          </Link>
        </div>

        <p style={{ margin: "20px 0 0", fontSize: 14.5 }}>
          Osäkra på hur mycket ni behöver?{" "}
          <Link href="/fika-till-jobbet" style={{ fontWeight: 600 }}>
            Guide: fika till jobbet — mängder per person, fredagsfika och möten
          </Link>{" "}
          · <Link href="/julfika" style={{ fontWeight: 600 }}>Julfika på jobbet</Link>
        </p>

        {/* FAQ före sidans avslutande CTA-band — sidan ska sluta i handling. */}
        <FaqList heading="Vanliga frågor om småkakor" items={KAKOR_FAQS} />
      </div>

      <section className="cta-band">
        <h2 className="h-section" style={{ marginBottom: 20 }}>
          Blanda sorterna fritt — vi levererar till er arbetsplats
        </h2>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
      </section>
    </>
  );
}
