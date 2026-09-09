import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { getActiveProducts, getDeliveryPostalPrefixes } from "@/lib/products";
import { FaqList } from "@/components/FaqList";
import { PollNudge } from "@/components/poll/PollNudge";
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
const PAGE_TITLE = "Kakor till kontoret på riktigt smör";
const PAGE_DESCRIPTION =
  "Kakor till kontoret: kolasnittar, mandelkubb och chokladsnittar på riktigt smör. Per kilo till företag i Tyresö, Nacka, Haninge och Huddinge, mot faktura.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/kakor" },
  ...sharePreview({ title: PAGE_TITLE, description: PAGE_DESCRIPTION, path: "/kakor" }),
};

// Renderas synligt längst ner på sidan + som FAQPage-schema (samma text).
// Svaren är generell bakkunskap eller verifierade verksamhetsfakta – inga löften.
const KAKOR_FAQS = [
  {
    q: "Säljer ni kakor till kontoret per kilo?",
    a: "Ja. Småkakorna säljs per kilo (eller som prova-på-paket 1,5 kg) till företag. Ni blandar sorter i samma beställning, får leverans till kontoret på områdets leveransdag och betalar mot faktura.",
  },
  {
    q: "Var kan man köpa kolasnittar, mandelkubb och chokladsnittar till företaget?",
    a: "Här. Varje sort har en egen sida med pris per kilo, ingredienser och allergener. Ni lägger kakorna i korgen, väljer leveransdag för Tyresö, Nacka, Haninge eller Huddinge och betalar mot faktura. Recept publicerar vi inte – vi säljer kakorna färdiga.",
  },
  {
    q: "Varför inte kakor från kontorsgrossisten?",
    a: "För att det är förvånansvärt svårt att hitta riktiga småkakor till företagsfikat där – det som finns är ofta fabrikskakor med margarin och långa innehållsförteckningar. Våra bakas i satser på riktigt smör efter recept ur Svenskt konditorlexikon, packas och fryses direkt och plockas från fryslagret i Tyresö till er på områdets leveransdag. Ni handlar per kilo och betalar mot faktura.",
  },
  {
    q: "Hur förvarar man småkakor bäst?",
    a: "I en tät burk i rumstemperatur, gärna med bakplåtspapper mellan lagren. Undvik kylskåp – kakor tar lätt smak och mister sin konsistens i kyla.",
  },
  {
    q: "Hur länge håller kakor i rumstemperatur?",
    a: "Bäst före-datum står på förpackningen. Förvara kakorna i en tät burk i rumstemperatur, öppna burken så lite som möjligt och lägg bakplåtspapper mellan lagren, så behåller de både smak och konsistens.",
  },
  {
    q: "Hur länge håller kakor i frysen?",
    a: "Småkakor tål frysning mycket bra. Frys i tät påse eller burk och låt tina i rumstemperatur – konsistens och smak håller sig i flera månader.",
  },
  {
    q: "Var bakas kakorna?",
    a: "Hos ett litet konditori i Šiauliai i Litauen, med några få personer och mycket handarbete, efter våra äldre svenska recept. Direkt efter bakningen packas och fryses kakorna, precis som förr, och transporteras frysta rakt in i vårt fryslager i Tyresö, där vi plockar beställningarna. Kakorna tinar på vägen till er och är redo att ställas fram när de kommer.",
  },
  {
    q: "Vad är sju sorters kakor?",
    a: "En klassisk svensk kaffebjudningstradition: minst sju olika småkakor på bordet. Mandelkubb, kolasnittar och chokladsnittar är tre av klassikerna som ofta ingår.",
  },
  {
    q: "Vad är gammaldags småkakor?",
    a: "Småkakor bakade som förr: på riktigt smör, socker, vetemjöl och ägg, utan margarin eller onödiga tillsatser. Våra tre sorter bakas efter recept ur Svenskt konditorlexikon från 1957.",
  },
  {
    q: "Hur mycket kakor går det åt per person?",
    a: "Räkna ungefär 3–5 småkakor per person till en fika. Hur många kakor ett kilo ger beror på sorten – snittar är lätta och mandelkubb tyngre – så prova-på-paketet är ett bra första köp för ett mindre gäng. Är ni fler, lägg till hela kilon av den sort ni tror mest på.",
  },
];

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Kakor", path: "/kakor" },
];

export default async function KakorPage() {
  const [products, postalPrefixes] = await Promise.all([getActiveProducts(), getDeliveryPostalPrefixes()]);

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
    ...products.map((p) => productNode(p, postalPrefixes)),
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
          <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)" }}>Kakor till kontoret på riktigt smör</h1>
          <div style={{ fontSize: 14, color: "var(--text-2)" }}>
            Säljs per kilo eller paket · blanda fritt i samma beställning
          </div>
        </div>
        <p className="lede" style={{ margin: "0 0 28px" }}>
          Klassiska svenska smörkakor efter recept från Svenskt konditorlexikon 1957 – kolasnittar,
          mandelkubb och chokladsnittar bakade på riktigt smör, vanligt strösocker och traditionella råvaror av hög kvalitet. Kaffekakor och fikabröd per kilo till arbetsplatser i Tyresö, Nacka, Haninge och
          Huddinge – betalning sker alltid mot faktura.
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
        <h2 className="h-sub" style={{ marginTop: 40, marginBottom: 10 }}>
          Småkakor per kilo till företaget – inte burken från grossisten
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--brown-2)", maxWidth: "65ch", margin: "0 0 8px" }}>
          Kontorsgrossisten säljer fabrikskakor i plastburk, ofta bakade på margarin. Vi säljer
          kakorna per kilo, bakade på riktigt smör: kolasnittar, mandelkubb och chokladsnittar.
          Ett kilo räcker till ett mindre gäng; blanda sorter i samma beställning. Kakor till
          kontoret levereras på områdets leveransdag i Tyresö, Nacka, Haninge och Huddinge och
          betalas mot faktura. Osäkra på mängden? Prova-på-paketet är 1,5&nbsp;kg – 0,5&nbsp;kg av
          varje sort.
        </p>
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
            Guide: fika till jobbet – mängder per person, fredagsfika och möten
          </Link>{" "}
          · <Link href="/julfika" style={{ fontWeight: 600 }}>Julfika på jobbet</Link>
        </p>

        {/* FAQ före sidans avslutande CTA-band – sidan ska sluta i handling. */}
        <PollNudge />
        <FaqList heading="Vanliga frågor om småkakor" items={KAKOR_FAQS} />
        <p style={{ marginTop: 16, fontSize: 14.5 }}>
          Frågor om leverans, faktura och prenumeration:{" "}
          <Link href="/vanliga-fragor" style={{ fontWeight: 600 }}>
            Vanliga frågor
          </Link>
        </p>
      </div>

      <section className="cta-band">
        <h2 className="h-section" style={{ marginBottom: 20 }}>
          Blanda sorterna fritt – vi levererar till er arbetsplats
        </h2>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
      </section>
    </>
  );
}
