import type { Metadata } from "next";
import Link from "next/link";
import { sharePreview } from "@/lib/seo/meta";
import { CONTENT_DATES } from "@/lib/seo/content-dates";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { FaqList } from "@/components/FaqList";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";

const TITLE = "Vanliga frågor om företagsfika";
const DESCRIPTION =
  "Korta svar om Sockerbagarens småkakor, företagsfika, leverans i Tyresö, Nacka, Haninge och Huddinge, faktura och fikaprenumeration.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/vanliga-fragor" },
  ...sharePreview({ title: TITLE, description: DESCRIPTION, path: "/vanliga-fragor" }),
};

const UPDATED = CONTENT_DATES["/vanliga-fragor"].updated;

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Vanliga frågor", path: "/vanliga-fragor" },
];

const FAQS = [
  {
    q: "Vad är Sockerbagaren?",
    a: "Sockerbagaren säljer gammaldags svenska småkakor på riktigt smör till företag. Sortimentet är kolasnittar, mandelkubb, chokladsnittar och ett prova-på-paket. Verksamheten drivs av Landvex AB och grundades 2025 av Tiffany Svensson.",
  },
  {
    q: "Vem är tjänsten till för?",
    a: "Företag och arbetsplatser: kontor, verkstäder, butiker och kliniker. Vi säljer inte till privatpersoner och tar inte kortbetalning.",
  },
  {
    q: "Vilka områden levererar ni till?",
    a: "Företagsadresser i Tyresö, Nacka, Haninge och Huddinge. Kassan kontrollerar postnumret. Vi har ingen butik och ingen utlämning.",
  },
  {
    q: "Hur fungerar företagsfika från Sockerbagaren?",
    a: "Ni väljer kakor och mängd, väljer leveransdag för ert område och får leveransen till en bemannad företagsadress. Fakturan mejlas direkt och förfaller efter leveransen.",
  },
  {
    q: "Vilka småkakor säljer ni?",
    a: "Kolasnittar, mandelkubb och chokladsnittar per kilo, plus ett prova-på-paket med 0,5 kg av varje sort. Recepten kommer ur Svenskt konditorlexikon.",
  },
  {
    q: "Var kan man köpa kakor till kontoret i Tyresö, Nacka, Haninge eller Huddinge?",
    a: "Här. Ni beställer kolasnittar, mandelkubb och chokladsnittar per kilo till en bemannad företagsadress. Kassan kontrollerar postnumret. Vi har ingen butik och säljer inte till privatpersoner.",
  },
  {
    q: "Vad kostar kakorna?",
    a: "Priset står på varje kaka, per kilo eller per paket, exklusive moms. Leveransen ingår. Inga dolda avgifter läggs på i kassan.",
  },
  {
    q: "Hur stora mängder kan man beställa?",
    a: "Minsta mängd är ett kilo per sort, eller ett prova-på-paket. Ni blandar sorter i samma beställning. Räkna 3–5 småkakor per person till en fika.",
  },
  {
    q: "Kan företag få faktura?",
    a: "Ja – det är det enda betalsättet. Fakturan skapas när ni beställer, mejlas till er faktura-e-post och förfaller efter leveransen. Inga kort och inga konton.",
  },
  {
    q: "Kan vi få kakor varje vecka?",
    a: "Ja. Fikaprenumerationen kommer varje, varannan eller var fjärde vecka på områdets leveransdag, utan bindningstid.",
  },
  {
    q: "Hur fungerar prenumerationen?",
    a: "Ni väljer kakor, mängd och intervall i samma kassa som engångsbeställningen. Inför varje leverans skapas en vanlig order med faktura. Ni pausar, hoppar över eller avslutar via den personliga länken i mejlet.",
  },
  {
    q: "Kan vi pausa en prenumeration?",
    a: "Ja. Använd den personliga länken i bekräftelsemejlet, eller svara på mejlet. Ingen bindningstid. En ändring efter att nästa order redan skapats gäller från leveransen därpå.",
  },
  {
    q: "Vilken dag levererar ni?",
    a: "Fasta leveransdagar per område, justerade i admin. Kassan visar nästa lediga dag för ert postnummer. Leveransen kommer under dagen, inte på klockslag.",
  },
  {
    q: "Hur långt i förväg behöver vi beställa?",
    a: "Så snart datumet visas i kassan går det att boka. Vi packar i förväg och visar därför bara dagar som går att hålla. Till ett möte: välj leveransdagen närmast före.",
  },
  {
    q: "Hur går leveransen till?",
    a: "Kakorna plockas i fryslagret i Tyresö och körs till er, av oss eller med anlitat bud. Adressen behöver vara bemannad: reception, personalrum eller lastkaj.",
  },
  {
    q: "Vilka allergener finns?",
    a: "Sorterna innehåller vete och smör (mjölk). Mandelkubb innehåller mandel. Chokladsnittar kan innehålla spår av mandel och soja. Fullständig förteckning står på varje produkt och under Ingredienser och allergener.",
  },
  {
    q: "Hur förvaras kakorna?",
    a: "I tät burk i rumstemperatur, gärna med bakplåtspapper mellan lagren. Inte i kylskåp. De tål frysning. Bäst före står på förpackningen.",
  },
  {
    q: "Var bakas kakorna?",
    a: "Hos ett litet konditori i Šiauliai i Litauen, efter våra svenska recept. De packas och fryses direkt och lagras i fryslager i Tyresö tills vi plockar er order.",
  },
];

export default function VanligaFragorPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path: "/vanliga-fragor",
            title: TITLE,
            description: DESCRIPTION,
            breadcrumbs: CRUMBS,
            dateModified: UPDATED,
          }),
          breadcrumbNode("/vanliga-fragor", CRUMBS),
          faqNode("/vanliga-fragor", FAQS)
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} container="container-narrow" />
      <div className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
        <PageHeader
          eyebrow="Frågor och svar"
          title="Vanliga frågor om företagsfika och småkakor"
          lede="Sockerbagaren säljer svenska småkakor till företag i södra Stockholm. Här är de korta svaren på det ni brukar fråga innan ni beställer – vad vi säljer, var vi kör, hur fakturan fungerar och hur en prenumeration sätts upp."
          facts={[
            { label: "Vad", value: "Småkakor till företagsfika" },
            { label: "Vem", value: "Företag, mot faktura" },
            { label: "Var", value: "Tyresö, Nacka, Haninge, Huddinge" },
            { label: "Hur ofta", value: "Engångs eller prenumeration" },
          ]}
        />

        <p>
          Behöver ni räkna mängd till ett möte eller fredagsfika finns guiden{" "}
          <Link href="/fika-till-jobbet">Fika till jobbet</Link>. Själva beställningen sker i{" "}
          <Link href="/bestall">kassan</Link>. Mer om{" "}
          <Link href="/kakor">sorterna</Link>, <Link href="/leverans">leveransen</Link> och{" "}
          <Link href="/prenumeration">fikaprenumerationen</Link> ligger på egna sidor – den här
          sidan är översikten.
        </p>

        <FaqList heading="Svaren i korthet" items={FAQS} />

        <h2>Nästa steg</h2>
        <p>
          Osäkra på sorten? Börja med prova-på-paketet. Vet ni redan vad som går hem: lägg kilon i
          korgen och välj nästa leveransdag för ert område.
        </p>
        <div className="actions">
          <Link href="/bestall" className="btn btn-primary btn-lg">
            Beställ kakor
          </Link>
          <Link href="/bestall?typ=aterkommande" className="btn btn-butter btn-lg">
            Starta fikaprenumeration
          </Link>
        </div>
      </div>
    </>
  );
}
