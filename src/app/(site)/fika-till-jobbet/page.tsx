import type { Metadata } from "next";
import Link from "next/link";
import { sharePreview } from "@/lib/seo/meta";
import { getActiveProducts, getDeliveryDaysLabel } from "@/lib/products";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { articleNode, breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";
import { formatOre } from "@/lib/money";
import { priceSuffix } from "@/lib/units";
import { PageHeader } from "@/components/PageHeader";
import { FaqList } from "@/components/FaqList";

// Guide-sida för det informativa sökbeteendet kring fika på arbetsplatsen.
// Semrush (se, 2026-09): "fika till jobbet" 320 (KD 22), "fredagsfika" 320,
// "fika på jobbet" 210, "fredagsfika på jobbet" 110, "fika att bjuda på
// jobbet" 170, "konferensfika" 30, "julfika" 1 600, "påskfika" 720.
// Innehållet är rådgivande och bygger på sortimentet — inga verksamhets-
// löften utöver det som gäller i kassan (leveransdagar hämtas ur admin).

export const dynamic = "force-dynamic";

const TITLE = "Fika till jobbet — hur mycket per person?";
const DESCRIPTION =
  "Guide till fika på jobbet: hur många småkakor per person, fredagsfika, mötes- och konferensfika, och hur ni beställer med leverans och faktura.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/fika-till-jobbet" },
  ...sharePreview({ title: TITLE, description: DESCRIPTION, path: "/fika-till-jobbet", image: { url: "/images/fika.jpg", alt: "Fika med småkakor och kaffe på jobbet" } }),
};

// Sätts vid verklig innehållsändring (aldrig byggtid).
const PUBLISHED = "2026-09-02";
const UPDATED = "2026-09-04";

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Fika till jobbet", path: "/fika-till-jobbet" },
];

const FAQS = [
  {
    q: "Hur många kakor per person ska man räkna med till fika på jobbet?",
    a: "Räkna med 3–5 småkakor per person till en vanlig fika. Är kakorna det enda tilltugget, eller fikat längre (till exempel en eftermiddagskonferens), räkna på 5. Kompletteras fikat med frukt eller smörgås räcker 3.",
  },
  {
    q: "Hur mycket är ett kilo småkakor?",
    a: "Det beror på sorten: snittar (kolasnittar och chokladsnittar) är lätta och ger många kakor per kilo, medan mandelkubb är en tyngre kaka som ger färre men mer mättande bitar. Prova-på-paketet med 0,5 kg av varje sort är ett bra sätt att se hur långt ett kilo räcker hos er.",
  },
  {
    q: "Vad passar bäst till fredagsfika på jobbet?",
    a: "En blandning av en ljus och en mörk sort brukar gå hem hos flest — till exempel kolasnittar och chokladsnittar — och mandelkubb för dem som vill ha något mer mättande till kaffet. Med en fikaprenumeration kommer samma blandning automatiskt varje eller varannan fredag.",
  },
  {
    q: "Kan man beställa fika till jobbet mot faktura?",
    a: "Ja. Hos oss betalar företag alltid mot faktura: fakturan skapas när ni beställer, mejlas till er faktura-e-post och förfaller först efter leveransen. Inga kort och inga konton.",
  },
  {
    q: "Hur långt i förväg behöver vi beställa fika?",
    a: "Leveransen kommer på ert områdes fasta leveransdag. Kassan visar nästa tillgängliga leveransdag för Tyresö, Nacka, Haninge och Huddinge direkt när ni väljer datum.",
  },
  {
    q: "Är fika på jobbet en skattefri förmån?",
    a: "Ja, enklare förtäring som kaffe, te och kakor räknas enligt Skatteverket som en skattefri personalvårdsförmån när den erbjuds hela personalen och intas på arbetsplatsen. För arbetsgivaren är kostnaden avdragsgill. Kontrollera alltid aktuella regler hos Skatteverket eller er redovisningskonsult.",
  },
  {
    q: "Vad bjuder man på sista dagen på jobbet eller vid en avtackning?",
    a: "Ett fat med klassiska småkakor räcker långt: det kräver ingen servering, går att dela ut på flera avdelningar och passar både förmiddagskaffet och eftermiddagen. Beställ till kontoret dagen före så finns det på plats när ni samlas.",
  },
  {
    q: "Håller kakorna till nästa dag?",
    a: "Ja. Småkakor på riktigt smör håller sig fina i flera veckor i en tät burk i rumstemperatur, och tål frysning i flera månader. Det som blir över på fredagen kan alltså sparas till måndagsmötet.",
  },
];

// Per-person-räknaren: 3–5 kakor per person (samma tumregel som FAQ:n).
const GROUPS = [10, 20, 30, 50];

export default async function FikaTillJobbetPage() {
  const [products, deliveryDays] = await Promise.all([getActiveProducts(), getDeliveryDaysLabel()]);
  const kgProducts = products.filter((p) => p.unit === "kg");
  const paket = products.find((p) => p.unit === "paket");

  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path: "/fika-till-jobbet", title: TITLE, description: DESCRIPTION, breadcrumbs: CRUMBS, dateModified: UPDATED }),
          articleNode({ path: "/fika-till-jobbet", headline: "Fika till jobbet — så ordnar ni det utan krångel", description: DESCRIPTION, image: "/images/fika.jpg", datePublished: PUBLISHED, dateModified: UPDATED }),
          breadcrumbNode("/fika-till-jobbet", CRUMBS),
          faqNode("/fika-till-jobbet", FAQS)
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} container="container-narrow" />
      <article className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
        <PageHeader
          eyebrow="Guide"
          title="Fika till jobbet — så ordnar ni det utan krångel"
          lede={
            <>
              Fika på jobbet är enkelt när någon annan har tänkt på mängder, sorter och leverans. Här
              är tumreglerna vi använder själva: hur mycket som går åt per person, vad som passar till
              fredagsfika, möten och konferenser, och hur beställningen fungerar med leverans
              {deliveryDays ? ` ${deliveryDays}` : ""} och betalning mot faktura.
            </>
          }
          facts={[
            { label: "Per person", value: "3–5 småkakor" },
            { label: "Leverans", value: deliveryDays ? `${deliveryDays} i södra Stockholm` : "Fasta dagar per område" },
            { label: "Betalning", value: "Faktura, förfaller efter leverans" },
            { label: "Minsta mängd", value: "1 kg per sort eller prova-på-paket" },
          ]}
        />

        <h2>Hur mycket fika per person — och till många?</h2>
        <p>
          Tumregeln är <strong>3–5 småkakor per person</strong>. Tre räcker när fikat har annat
          tilltugg också, fem när kakorna är det enda som bjuds eller när fikat drar ut på tiden.
          Hur många kakor ett kilo ger beror på sorten — snittar är lätta, mandelkubb tyngre — så
          första gången är prova-på-paketet det säkraste sättet att se vad som går åt hos er.
        </p>
        <p className="pull">Tre kakor per person när fikat har annat tilltugg, fem när kakorna är det enda som bjuds.</p>
        <div className="rule-label" style={{ marginTop: 18 }}>Kakor att räkna med</div>
        <table>
          <thead>
            <tr>
              <th>Antal personer</th>
              <th className="num">Lätt fika (3 st)</th>
              <th className="num">Rejäl fika (5 st)</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((n) => (
              <tr key={n}>
                <td style={{ fontWeight: 700 }}>{n} personer</td>
                <td className="num">{n * 3} kakor</td>
                <td className="num">{n * 5} kakor</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Fredagsfika på jobbet</h2>
        <p>
          Fredagsfikat är den fika som oftast blir av — och oftast glöms bort att beställa. En
          blandning av en ljus och en mörk sort går hem hos flest: kolasnittar för den sega
          kolasmaken, chokladsnittar för chokladen och mandelkubb för dem som vill ha en rejäl
          kaka till kaffet. Vill ni slippa komma ihåg det varje vecka gör{" "}
          <Link href="/prenumeration">fikaprenumerationen</Link> om samma beställning automatiskt,
          varje eller varannan vecka, utan bindningstid.
        </p>

        <h2>Mötesfika och konferensfika</h2>
        <p>
          Till ett kundmöte eller en halvdagskonferens fungerar småkakor bättre än bakelser: de
          kräver ingen tallrik, håller sig fräscha hela dagen och kan stå framme på ett fat vid
          kaffet. Räkna med den rejäla mängden (5 per person) när fikat är dagens enda paus, och
          beställ till en bemannad adress — reception eller konferensvärd — så att leveransen kan
          tas emot under dagen.
        </p>

        <h2>Julfika, påskfika och sommaravslutning</h2>
        <p>
          Klassiska småkakor passar året runt: mandelkubb och kolasnittar hör hemma på julfikat
          lika självklart som på påskens kaffebord eller sommaravslutningen. Beställ i god tid
          inför storhelger — leveransdagarna är fasta per område och kassan visar vilka datum som
          är lediga. Mer om <Link href="/julfika">julfika och påskfika på jobbet</Link>.
        </p>

        <h2>Kakor till kaffet på kontoret</h2>
        <p>
          Kaffet på kontoret är oftast löst: maskin eller bryggare, alltid på. Det som saknas är
          något gott till kaffet. Kaffekakor som kolasnittar, mandelkubb och chokladsnittar är
          gjorda för just det: de håller sig fräscha i burken hela veckan, tål att stå framme och
          kräver varken kylskåp eller tallrik. Beställ per kilo, ställ en burk vid kaffemaskinen och
          fyll på när den börjar sina.
        </p>

        <h2>Bjuda på fika på jobbet</h2>
        <p>
          Födelsedag, sista dagen på jobbet, avtackning eller bara ett tack till teamet: att bjuda
          på fika är det enklaste sättet att markera en händelse utan att ordna något stort. Räkna
          med den rejäla mängden (5 kakor per person) när fikat är dagens samlingspunkt, och beställ
          till kontoret med leverans dagen innan så att det står klart när ni samlas.
        </p>

        <h2>Är fika på jobbet skattefritt?</h2>
        <p>
          Enligt Skatteverket är enklare förtäring på arbetsplatsen, som kaffe, te, frukt och kakor,
          en skattefri personalvårdsförmån för de anställda när den erbjuds hela personalen och
          intas på arbetsplatsen. För arbetsgivaren är kostnaden avdragsgill. Fakturan från oss
          fungerar som underlag i bokföringen. Reglerna kan ändras, så stäm av med er
          redovisningskonsult om ni är osäkra.
        </p>

        <h2>Sorterna och vad de kostar</h2>
        <ul>
          {kgProducts.map((p) => (
            <li key={p.id}>
              <Link href={`/kakor/${p.slug}`} style={{ fontWeight: 600 }}>
                {p.name}
              </Link>{" "}
              — {formatOre(p.pricePerKgOre)}
              {priceSuffix(p.unit)} exkl. moms
            </li>
          ))}
          {paket && (
            <li>
              <Link href={`/kakor/${paket.slug}`} style={{ fontWeight: 600 }}>
                {paket.name}
              </Link>{" "}
              — {formatOre(paket.pricePerKgOre)}
              {priceSuffix(paket.unit)} exkl. moms, 0,5 kg av varje sort
            </li>
          )}
        </ul>
        <p>
          Alla sorter bakas på riktigt smör efter recept ur Svenskt konditorlexikon 1957. Fullständiga{" "}
          <Link href="/ingredienser">ingredienser och allergener</Link> finns för varje sort — bra
          att ha till hands när kollegor frågar om mandel, ägg eller mjölk.
        </p>

        <h2>Så beställer ni</h2>
        <ol>
          <li>Välj sorter och mängd per kilo, eller prova-på-paketet.</li>
          <li>Välj leveransdag för ert område — Tyresö, Nacka, Haninge eller Huddinge.</li>
          <li>Ange företagsuppgifter och faktura-e-post. Fakturan förfaller efter leveransen.</li>
        </ol>
        <div className="actions">
          <Link href="/bestall" className="btn btn-primary btn-lg">
            Beställ kakor
          </Link>
          <Link href="/bestall?typ=aterkommande" className="btn btn-butter btn-lg">
            Starta fikaprenumeration
          </Link>
        </div>

        <FaqList heading="Vanliga frågor om fika på jobbet" items={FAQS} />
      </article>
    </>
  );
}
