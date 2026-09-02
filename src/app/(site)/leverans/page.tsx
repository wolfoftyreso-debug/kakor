import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { getAreasWithDates } from "@/lib/products";
import { capitalizeFirst, formatDeliveryDate, fromISODate, weekdayName } from "@/lib/dates";
import { ImageSlot } from "@/components/ImageSlot";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";

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
    <div className="container-narrow" style={{ padding: "24px 24px 80px" }}>
      <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)", marginBottom: 14 }}>
        Fikaleverans i södra Stockholm
      </h1>
      <p className="lede">
        Fasta leveransdagar per område. Leveransen kommer under dagen — vi kan
        inte lova exakt klockslag, så någon behöver finnas på plats för att ta emot den: reception,
        personalrum eller lastkaj.
      </p>

      <div style={{ height: 340, borderRadius: "var(--radius-xl)", overflow: "hidden", margin: "28px 0 4px", boxShadow: "var(--shadow-md)" }}>
        <ImageSlot
          label="Sockerbagarens bud bär en kartong med kakor till leveransbilen"
          src="/images/leverans.jpg"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, margin: "32px 0" }}>
        {areas.map((a) => (
          <div key={a.slug} className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700 }}>
              <Link href={`/${a.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                {a.name}
              </Link>
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 6 }}>
              Leveransdag: {[...new Set(a.weekdays)].map(weekdayName).join(" och ")}
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

      <h2 style={{ fontSize: 22, margin: "32px 0 12px" }}>Betalning</h2>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        All betalning sker mot faktura. Fakturan skickas till er faktura-e-post och kan även laddas
        ner som PDF direkt efter beställningen. Inga kort, inga konton.
      </p>

      <h2 style={{ fontSize: 22, margin: "32px 0 6px" }}>Vanliga frågor om leveransen</h2>
      <div>
        {LEVERANS_FAQS.map((f) => (
          <div key={f.q} style={{ borderBottom: "1px solid var(--border)", padding: "14px 4px" }}>
            <h3 style={{ fontSize: "15.5px", fontWeight: 700, fontFamily: "var(--font-sans)" }}>{f.q}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--brown-2)", margin: "6px 0 0", maxWidth: "65ch" }}>{f.a}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
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
