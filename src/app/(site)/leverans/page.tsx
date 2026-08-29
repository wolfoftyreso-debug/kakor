import type { Metadata } from "next";
import Link from "next/link";
import { getAreasWithDates } from "@/lib/products";
import { formatDeliveryDate, fromISODate, weekdayName } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leverans",
  description:
    "Så fungerar leveransen: fasta leveransdagar per område i Tyresö, Nacka, Haninge och Huddinge. Vi levererar under dagen till bemannade företagsadresser.",
  alternates: { canonical: "/leverans" },
};

export default async function LeveransPage() {
  const areas = await getAreasWithDates(2);
  return (
    <div className="container-narrow" style={{ padding: "48px 24px 80px" }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 12 }}>Leverans</h1>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Vi kör själva, på fasta leveransdagar per område. Leveransen kommer under dagen — vi kan
        inte lova exakt klockslag, så någon behöver finnas på plats för att ta emot den: reception,
        personalrum eller lastkaj.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, margin: "32px 0" }}>
        {areas.map((a) => (
          <div key={a.slug} className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700 }}>
              <Link href={`/${a.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                {a.name}
              </Link>
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 6, textTransform: "capitalize" }}>
              Leveransdag: {[...new Set(a.weekdays)].map(weekdayName).join(" och ")}
            </div>
            {a.upcomingDates[0] && (
              <div style={{ fontSize: "13.5px", marginTop: 4 }}>
                Nästa:{" "}
                <strong style={{ textTransform: "capitalize" }}>
                  {formatDeliveryDate(fromISODate(a.upcomingDates[0]))}
                </strong>
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

      <div style={{ marginTop: 32 }}>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ kakor
        </Link>
      </div>
    </div>
  );
}
