import type { Metadata } from "next";
import Link from "next/link";
import { sharePreview } from "@/lib/seo/meta";
import { InfoPageSeo } from "@/components/InfoPageSeo";
import { PageHeader } from "@/components/PageHeader";
import { PollSection } from "@/components/poll/PollSection";
import { FaqList } from "@/components/FaqList";
import { getPollHistory } from "@/lib/polls/service";
import { getActiveProducts } from "@/lib/products";
import { CONTENT_DATES } from "@/lib/seo/content-dates";

const DESCRIPTION =
  "Hallongrotta, dröm eller schackruta? Ni röstar, vinnaren bakas efter receptet i Svenskt konditorlexikon. Sortimentet växer ett klassiskt recept i taget.";

export const metadata: Metadata = {
  title: { absolute: "Folkets nästa småkaka – rösta fram nästa klassiker" },
  description: DESCRIPTION,
  alternates: { canonical: "/folkets-kaka" },
  ...sharePreview({
    title: "Folkets nästa småkaka",
    description: DESCRIPTION,
    path: "/folkets-kaka",
    image: { url: "/images/bakning.jpg", alt: "Småkakor på plåt" },
  }),
};
export const dynamic = "force-dynamic";

const FAQS = [
  {
    q: "Vad är Folkets nästa småkaka?",
    a: "En omröstning där kunderna väljer vilken klassisk småkaka ur Svenskt konditorlexikon som blir nästa i Sockerbagarens sortiment. Ni röstar, vinnaren bakas på riktigt smör.",
  },
  {
    q: "Hur röstar man?",
    a: "Välj en av kandidaterna på den här sidan och skicka din röst. En röst per person. Resultatet visas när du har röstat – inte före.",
  },
  {
    q: "Vad händer med vinnaren?",
    a: "Vinnaren bakas efter recepttraditionen i boken. När den finns att beställa märks den Folkets val i sortimentet, med året den röstades fram. Därefter öppnar nästa omgång.",
  },
];

// Berättelsen och röstningen på en permanent, delbar adress. Rösten och
// resultatet hanteras av PollSection; sidan bär sammanhanget.
export default async function FolketsKakaPage() {
  const [history, products] = await Promise.all([getPollHistory(), getActiveProducts()]);
  const originals = products.filter((p) => p.unit === "kg");
  const winners = history.filter((h) => h.winner);

  return (
    <>
      <InfoPageSeo path="/folkets-kaka" name="Folkets nästa småkaka" title="Folkets nästa småkaka" description={DESCRIPTION} dateModified={CONTENT_DATES["/folkets-kaka"].updated} faqs={FAQS} />
      <div className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
        <PageHeader
          eyebrow="Folkets nästa småkaka"
          title="Vilken klassiker ska bli nästa?"
          lede="Vi vill väcka recepten ur Svenskt konditorlexikon till liv igen – ett i taget. Nu får ni bestämma vilken småkaka som blir nästa i Sockerbagarens sortiment."
        />

        <PollSection variant="full" placement="folkets-kaka" showLink={false} />

        <h2>Recept med en historia</h2>
        <p>
          Sockerbagarens ambition är inte att hitta på nya trendkakor varje månad. Vi vill i stället
          gå tillbaka till det svenska konditorhantverket och återuppliva klassikerna.
        </p>
        <p>
          Vår utgångspunkt är Svenskt konditorlexikon – boken som gått i arv i familjen och som blev
          början på hela idén bakom Sockerbagaren. Ur den vill vi successivt välja ut och återskapa
          fler av de klassiska recepten. Och ni får hjälpa oss att välja ordningen. Kunderna röstar.
          Vinnaren bakas på riktigt smör och utan genvägar, precis som{" "}
          <Link href="/kakor">de tre sorter vi började med</Link>.{" "}
          <Link href="/om">Läs hela berättelsen om boken och Sockerbagaren.</Link>
        </p>

        <h2>Så växer kakfatet</h2>
        <ol className="poll-timeline">
          <li>
            <span className="poll-timeline-label">Våra första kakor</span>
            <span className="poll-timeline-body">
              {originals.length > 0 ? originals.map((p) => p.name).join(", ") : "Mandelkubb, Kolasnittar, Chokladsnittar"}. Bakade efter recepten i Svenskt konditorlexikon.
            </span>
          </li>
          {history.map(({ poll, state, results, winner }) => (
            <li key={poll.id}>
              <span className="poll-timeline-label">Folkets val {poll.sequence}</span>
              <span className="poll-timeline-body">
                {state === "OPEN"
                  ? `Röstningen pågår: ${poll.candidates.map((c) => c.name).join(", ")}. Avslutas ${poll.deadlineLabel ? `på ${poll.deadlineLabel}` : ""}.`
                  : state === "CLOSED"
                    ? `Röstningen är avslutad – ${results.total} personer röstade. Vinnaren presenteras snart.`
                    : winner
                      ? `${winner.name}, framröstad av ${results.total} personer ${poll.endsAt.getFullYear()}.${state === "LAUNCHED" && winner.product ? " Finns nu i sortimentet." : " Bakas fram nu."}`
                      : "Kommande omgång."}
              </span>
            </li>
          ))}
          <li className="muted">
            <span className="poll-timeline-label">Nästa omgång</span>
            <span className="poll-timeline-body">När vinnaren är lanserad väljer vi tre nya klassiker ur boken – och ni röstar igen.</span>
          </li>
        </ol>
        {winners.length > 0 && (
          <p>
            Varje framröstad kaka bär märkningen <strong>Folkets val</strong> i sortimentet, med året den valdes. Så blir varje ny sort en del av historien i stället för bara en nyhet.
          </p>
        )}

        <h2>Vårt uppdrag</h2>
        <dl className="poll-mission">
          <div><dt>Uppdraget</dt><dd>Vi vill återuppliva de svenska småkakorna.</dd></div>
          <div><dt>Källan</dt><dd>Svenskt konditorlexikon och den svenska konditortraditionen.</dd></div>
          <div><dt>Metoden</dt><dd>Riktiga råvaror, riktigt smör, traditionellt hantverk och inga genvägar.</dd></div>
          <div><dt>Er roll</dt><dd>Ni hjälper oss bestämma vilket recept vi tar oss an härnäst.</dd></div>
          <div><dt>Resultatet</dt><dd>Sockerbagarens sortiment växer ett klassiskt recept i taget.</dd></div>
        </dl>
        <FaqList heading="Vanliga frågor om omröstningen" items={FAQS} />
        <div className="actions">
          <Link href="/kakor" className="btn btn-outline">Se kakorna i sortimentet</Link>
          <Link href="/bestall" className="btn btn-primary">Beställ till jobbet</Link>
        </div>
      </div>
    </>
  );
}
