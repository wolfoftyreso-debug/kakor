import type { Metadata } from "next";
import Link from "next/link";
import { sharePreview } from "@/lib/seo/meta";
import { getActiveProducts, getDeliveryDaysLabel } from "@/lib/products";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";
import { formatOre } from "@/lib/money";
import { priceSuffix } from "@/lib/units";
import { PageHeader } from "@/components/PageHeader";
import { FaqList } from "@/components/FaqList";

// Säsongssida. Semrush (se, 2026-09): "julfika" 1 600/mån (KD 23) med hela
// volymen i november–december, "påskfika" 720 (KD 20) i mars–april,
// "julfika på jobbet" 10. Sidan ligger ute året runt så att den är indexerad
// när säsongen börjar. Inga löften om särskilda julsorter — sortimentet är
// detsamma året runt och hämtas ur databasen.

export const dynamic = "force-dynamic";

const TITLE = "Julfika på jobbet — beställ kakor i tid";
const DESCRIPTION =
  "Julfika och påskfika på jobbet: hur mycket ni behöver, när ni bör beställa inför helgerna och vilka klassiska småkakor som passar. Leverans till företag i södra Stockholm, faktura.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/julfika" },
  ...sharePreview({ title: TITLE, description: DESCRIPTION, path: "/julfika", image: { url: "/images/hero.jpg", alt: "Fat med chokladsnittar, mandelkubb och kolasnittar" } }),
};

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Fika till jobbet", path: "/fika-till-jobbet" },
  { name: "Julfika på jobbet", path: "/julfika" },
];

const FAQS = [
  {
    q: "När ska vi beställa julfikat?",
    a: "Beställ så snart ni vet datumet. Leveransdagarna är fasta per område och veckorna före jul är de mest bokade. Kassan visar vilka leveransdagar som är lediga för ert område.",
  },
  {
    q: "Hur mycket kakor behövs till ett julfika?",
    a: "Räkna med 5 småkakor per person när julfikat är dagens samlingspunkt, gärna med två eller tre sorter så att alla hittar en favorit. Blir det över håller kakorna i tät burk till mellandagarna.",
  },
  {
    q: "Har ni särskilda julkakor?",
    a: "Sortimentet är detsamma året runt: kolasnittar, mandelkubb och chokladsnittar på riktigt smör efter recept från 1957. Mandelkubb och kolasnittar är klassiska inslag på svenska julbord och passar lika bra till glöggen som till kaffet.",
  },
  {
    q: "Kan vi pausa fikaprenumerationen över jul och nyår?",
    a: "Ja. Svara på bekräftelsemejlet så pausar vi prenumerationen över helgerna och startar den igen den vecka ni vill. Ingen bindningstid.",
  },
  {
    q: "Levererar ni till påskfikat också?",
    a: "Ja, samma sortiment och samma leveransdagar. Beställ i veckan före påsk så att leveransen hinner fram före skärtorsdagen.",
  },
];

export default async function JulfikaPage() {
  const [products, deliveryDays] = await Promise.all([getActiveProducts(), getDeliveryDaysLabel()]);
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path: "/julfika", title: TITLE, description: DESCRIPTION, breadcrumbs: CRUMBS }),
          breadcrumbNode("/julfika", CRUMBS),
          faqNode("/julfika", FAQS)
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} container="container-narrow" />
      <article className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
        <PageHeader
          eyebrow="Säsong"
          title="Julfika på jobbet"
          lede={
            <>
              Julfikat är årets viktigaste fika på många arbetsplatser, och det som oftast beställs för
              sent. Här är det ni behöver veta: hur mycket som går åt, när ni bör beställa och vilka
              kakor som passar. Leverans{deliveryDays ? ` ${deliveryDays}` : ""} till företag i Tyresö,
              Nacka, Haninge och Huddinge, betalning mot faktura.
            </>
          }
          facts={[
            { label: "Per person", value: "5 småkakor" },
            { label: "Beställ", value: "Så snart datumet är satt" },
            { label: "Leverans", value: deliveryDays ? `${deliveryDays}, under dagen` : "Fasta dagar per område" },
            { label: "Sortiment", value: "Samma året runt" },
          ]}
        />

        <h2>Beställ i tid</h2>
        <p>
          Leveransdagarna är fasta per område, och veckorna före jul är de mest efterfrågade. Välj
          datum i kassan så snart julfikat är inbokat: kassan visar bara lediga leveransdagar, så ni
          ser direkt om ert datum går att få. Leveransen kommer under dagen till en bemannad adress.
        </p>

        <h2>Så mycket behöver ni</h2>
        <p>
          Räkna med <strong>5 småkakor per person</strong> till ett julfika där kakorna är
          huvudsaken, och 3 om det också finns pepparkakor, lussebullar eller annat på bordet. Med
          två eller tre sorter blir fatet både vackrare och räcker längre, eftersom alla inte tar
          av samma. Läs mer i vår <Link href="/fika-till-jobbet">guide till fika på jobbet</Link>.
        </p>

        <h2>Kakorna till julfikat</h2>
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/kakor/${p.slug}`} style={{ fontWeight: 600 }}>
                {p.name}
              </Link>{" "}
              — {formatOre(p.pricePerKgOre)}
              {priceSuffix(p.unit)} exkl. moms
            </li>
          ))}
        </ul>
        <p>
          Mandelkubb och kolasnittar hör till de småkakor som traditionellt står på svenska
          julbord, och chokladsnittarna ger den mörka sort som fatet behöver. Alla bakas på riktigt
          smör efter recept ur Svenskt konditorlexikon 1957.
        </p>

        <h2>Påskfika och sommaravslutning</h2>
        <p>
          Samma upplägg gäller för påskfikat och sommaravslutningen: beställ veckan innan, räkna
          på 3–5 kakor per person och välj gärna flera sorter. Har ni en fikaprenumeration fortsätter
          den som vanligt över helgerna, eller pausas när ni vill genom att svara på bekräftelsemejlet.
        </p>

        <div className="actions">
          <Link href="/bestall" className="btn btn-primary btn-lg">
            Beställ kakor
          </Link>
          <Link href="/fika-till-jobbet" className="btn btn-outline btn-lg">
            Guide: fika till jobbet
          </Link>
        </div>

        <FaqList heading="Vanliga frågor om julfika på jobbet" items={FAQS} />
      </article>
    </>
  );
}
