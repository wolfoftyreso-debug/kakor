import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { invoiceConfig } from "@/lib/config";
import { InfoPageSeo } from "@/components/InfoPageSeo";

export const metadata: Metadata = {
  title: "Leverans- & köpvillkor",
  description: "Leverans-, köp- och fakturavillkor för beställningar hos Sockerbagaren.",
  alternates: { canonical: "/villkor" },
  ...sharePreview({
    title: "Leverans- & köpvillkor",
    description:
      "Leverans-, köp- och fakturavillkor för beställningar hos Sockerbagaren.",
    path: "/villkor",
  }),
};

// Senast innehållsändrad — uppdateras manuellt vid verklig villkorsändring,
// aldrig automatiskt per deploy.
const CONTENT_UPDATED = "2026-08-31";

export default function VillkorPage() {
  return (
    <>
    <InfoPageSeo
      path="/villkor"
      name="Leverans- & köpvillkor"
      title="Leverans- & köpvillkor"
      description={String(metadata.description)}
      dateModified={CONTENT_UPDATED}
    />
    <div className="container-narrow" style={{ padding: "24px 24px 80px" }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 20 }}>
        Leverans- &amp; köpvillkor
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 20px" }}>
        Uppdaterad {CONTENT_UPDATED}
      </p>
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
            Betalning sker mot faktura. Fakturan skapas i samband med beställningen, skickas till
            angiven faktura-e-post och kan även
            laddas ner som PDF. Betalningsvillkor: {invoiceConfig.paymentTermsDays} dagar från
            fakturadatum. Priser anges exklusive moms; moms för livsmedel (12&nbsp;%) tillkommer
            och specificeras i kassan och på fakturan tillsammans med nettobelopp och totalsumma.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Prenumeration</h2>
          <p style={{ margin: 0 }}>
            Fikaprenumerationen innebär att en vanlig order med faktura skapas inför varje
            leverans enligt valt intervall. Ingen bindningstid — ni pausar eller avslutar när ni
            vill genom att svara på bekräftelsemejlet.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Avbokning &amp; ändringar</h2>
          <p style={{ margin: 0 }}>
            Ändringar och avbokningar hanteras så långt det är möjligt — ju tidigare besked,
            desto bättre: svara på orderbekräftelsen med ordernumret. Eftersom leveranserna packas och planeras per leveransdag kan
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
    </>
  );
}
