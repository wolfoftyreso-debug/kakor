import type { Metadata } from "next";
import { invoiceConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Leverans- & köpvillkor",
  description: "Leverans-, köp- och fakturavillkor för beställningar hos Sockerbagaren.",
  alternates: { canonical: "/villkor" },
};

export default function VillkorPage() {
  return (
    <div className="container-narrow" style={{ padding: "48px 24px 80px" }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 20 }}>
        Leverans- &amp; köpvillkor
      </h1>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--brown-2)", maxWidth: "65ch", display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Beställning</h2>
          <p style={{ margin: 0 }}>
            Beställningar görs via sockerbagaren.se och riktar sig till företag och organisationer.
            När beställningen skickats får ni en orderbekräftelse med ordernummer till angiven
            e-postadress. Ingen kortbetalning sker på webbplatsen.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Leverans</h2>
          <p style={{ margin: 0 }}>
            Vi levererar på fasta leveransdagar per område, till bemannade företagsadresser i
            Tyresö, Nacka, Haninge och Huddinge. Leveransen sker under dagen — vi anger inte
            exakt klockslag, så någon behöver finnas på plats för att ta emot leveransen. Vald
            leveransdag framgår av orderbekräftelsen.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Betalning &amp; faktura</h2>
          <p style={{ margin: 0 }}>
            Betalning sker mot faktura. Fakturan skickas till angiven faktura-e-post och kan även
            laddas ner som PDF. Betalningsvillkor: {invoiceConfig.paymentTermsDays} dagar från
            fakturadatum. Priser anges inklusive moms (livsmedel, 12&nbsp;%) i kassan; fakturan
            specificerar nettobelopp, moms och totalsumma.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Prenumeration</h2>
          <p style={{ margin: 0 }}>
            Fikaprenumerationen innebär att en vanlig order med faktura skapas inför varje
            leverans enligt valt intervall. Ingen bindningstid — ni kan pausa eller avsluta genom
            att kontakta oss.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Avbokning &amp; ändringar</h2>
          <p style={{ margin: 0 }}>
            Kontakta oss så snart som möjligt om ni behöver ändra eller avboka en beställning, så
            löser vi det tillsammans. Eftersom kakorna bakas färskt inför varje leverans kan
            ändringar nära inpå leveransdagen vara svåra att tillgodose.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Säljare</h2>
          <p style={{ margin: 0 }}>
            {invoiceConfig.companyName}, org.nr {invoiceConfig.orgNumber},{" "}
            {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}.
          </p>
        </section>
      </div>
    </div>
  );
}
