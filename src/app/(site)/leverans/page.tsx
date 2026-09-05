import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { getAreasWithDates } from "@/lib/products";
import { capitalizeFirst, formatDeliveryDate, fromISODate, weekdayName, listSv } from "@/lib/dates";
import { ImageSlot } from "@/components/ImageSlot";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";
import { PageHeader } from "@/components/PageHeader";
import { FaqList } from "@/components/FaqList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fikaleverans till företag i södra Stockholm",
  description:
    "Fikaleverans till arbetsplatser i södra Stockholm: fasta leveransdagar i Tyresö, Nacka, Haninge och Huddinge, under dagen till bemannade företagsadresser.",
  alternates: { canonical: "/leverans" },
  ...sharePreview({
    title: "Fikaleverans till företag i södra Stockholm",
    description:
      "Fikaleverans till arbetsplatser i södra Stockholm: fasta leveransdagar i Tyresö, Nacka, Haninge och Huddinge, under dagen till bemannade företagsadresser.",
    path: "/leverans",
    image: { url: "/images/leverans.jpg", alt: "Kartong med kakor på väg ut för leverans" },
  }),
};

const CRUMBS = [
  { name: "Sockerbagaren", path: "/" },
  { name: "Leverans", path: "/leverans" },
];

const LEVERANS_FAQS = [
  {
    q: "Vilka områden levererar ni till?",
    a: "Företagsadresser i Tyresö, Nacka, Haninge och Huddinge. Kassan kontrollerar postnumret och visar områdets leveransdagar.",
  },
  {
    q: "Kan ni leverera en viss tid?",
    a: "Nej — leveransen kommer under dagen på områdets leveransdag. Adressen behöver vara bemannad: reception, personalrum eller lastkaj.",
  },
  {
    q: "Hur snabbt kan vi få leverans?",
    a: "Kassan visar nästa tillgängliga leveransdag för ert område direkt när ni väljer datum. Beställ i tid — leveransdagarna är fasta per område.",
  },
  {
    q: "Vad kostar leveransen?",
    a: "Ingen separat leveransavgift läggs på i webbshoppen — ni betalar priset per kilo respektive per paket plus moms, precis som kassan visar innan ni skickar beställningen.",
  },
];

export default async function LeveransPage() {
  const areas = await getAreasWithDates(2);
  return (
    <>
    <JsonLd
      data={graph(
        webPageNode({
          path: "/leverans",
          title: "Fikaleverans i södra Stockholm",
          description: metadata.description ?? undefined,
          breadcrumbs: CRUMBS,
        }),
        breadcrumbNode("/leverans", CRUMBS),
        faqNode("/leverans", LEVERANS_FAQS)
      )}
    />
    <Breadcrumbs crumbs={CRUMBS} container="container-narrow" />
    <div className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
      <PageHeader
        eyebrow="Leverans"
        title="Fikaleverans i södra Stockholm"
        lede="Fasta leveransdagar per område. Leveransen kommer under dagen — vi kan inte lova exakt klockslag, så någon behöver finnas på plats för att ta emot den: reception, personalrum eller lastkaj."
        facts={[
          { label: "Områden", value: "Tyresö, Nacka, Haninge, Huddinge" },
          { label: "Leveransdag", value: listSv([...new Set(areas.flatMap((a) => a.weekdays))].map(weekdayName)) || "Se område" },
          { label: "Tid", value: "Under dagen, bemannad adress" },
          { label: "Leveransavgift", value: "Ingen" },
        ]}
      />
      <figure>
        <div className="media" style={{ minHeight: 320 }}>
          <ImageSlot label="Kartong med kakor lastas för leverans" src="/images/leverans.jpg" />
        </div>
      </figure>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, margin: "32px 0" }}>
        {areas.map((a) => (
          <div key={a.slug} className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700 }}>
              <Link href={`/${a.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                {a.name}
              </Link>
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 6 }}>
              Leveransdag: {listSv([...new Set(a.weekdays)].map(weekdayName))}
            </div>
            {a.upcomingDates[0] && (
              <div style={{ fontSize: "13.5px", marginTop: 4 }}>
                Nästa:{" "}
                <strong>{capitalizeFirst(formatDeliveryDate(fromISODate(a.upcomingDates[0])))}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="info-box" style={{ marginBottom: 24 }}>
        Vi levererar under dagen till bemannade företagsadresser. Se till att någon kan ta emot
        leveransen.
      </div>

      <h2>Betalning</h2>
      <p>
        All betalning sker mot faktura. Fakturan skickas till er faktura-e-post och kan även laddas
        ner som PDF direkt efter beställningen. Inga kort, inga konton.
      </p>

      <FaqList heading="Vanliga frågor om leveransen" items={LEVERANS_FAQS} />

      <div className="actions">
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
        <Link href="/fika-till-jobbet" className="btn btn-outline btn-lg">
          Guide: fika till jobbet
        </Link>
      </div>
    </div>
    </>
  );
}
