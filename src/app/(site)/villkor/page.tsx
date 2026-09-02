import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { invoiceConfig, isVerifiedValue } from "@/lib/config";
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
const CONTENT_UPDATED = "2026-09-02";

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
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Avtal och behörighet</h2>
          <p style={{ margin: 0 }}>
            Beställningar görs via vår webbplats och riktar sig endast till företag och
            organisationer. Avtal ingås när ni skickar beställningen och vi bekräftar den med en
            orderbekräftelse med ordernummer till angiven e-postadress. Den som beställer ansvarar
            för att hen är behörig att beställa för det angivna företaget (organisationsnumret). Vi
            förbehåller oss rätten att neka en beställning. Ingen kortbetalning sker på
            webbplatsen.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Priser</h2>
          <p style={{ margin: 0 }}>
            Priserna på webbplatsen gäller vid beställningstillfället och anges i svenska kronor
            exklusive moms. Moms enligt gällande momssats tillkommer och specificeras i kassan och
            på fakturan tillsammans med nettobelopp och totalsumma.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Leverans och risk</h2>
          <p style={{ margin: 0 }}>
            Vi levererar på fasta leveransdagar per område, till bemannade företagsadresser i
            Tyresö, Nacka, Haninge och Huddinge. Leveransen sker under dagen — vi anger inte
            exakt klockslag, så någon behöver finnas på plats för att ta emot leveransen. Vald
            leveransdag framgår av orderbekräftelsen. Risken för varan övergår till er när den
            överlämnats på den angivna adressen.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Betalning &amp; faktura</h2>
          <p style={{ margin: 0 }}>
            Betalning sker mot faktura. Fakturan skapas när ni skickar beställningen, mejlas till
            angiven faktura-e-post och kan även laddas ner som PDF. Betalningsvillkor:{" "}
            {invoiceConfig.paymentTermsDays} dagar netto från fakturadatum. Vid försenad betalning
            utgår dröjsmålsränta enligt räntelagen samt förseningsersättning enligt lagen om
            ersättning för inkassokostnader. Avbryts en fakturerad beställning krediteras fakturan
            med en kreditfaktura.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Reklamation</h2>
          <p style={{ margin: 0 }}>
            Kakorna är färskvara. Kontrollera leveransen vid mottagandet och reklamera synliga fel
            (skadad förpackning, fel sort eller mängd) samma dag och övriga fel utan dröjsmål,
            genom att svara på orderbekräftelsen med ordernumret. Vid befogad reklamation ersätter
            vi varan eller krediterar motsvarande belopp. Vårt ansvar är begränsat till
            fakturabeloppet för den berörda leveransen och omfattar inte indirekt skada.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Fikaprenumeration</h2>
          <p style={{ margin: 0 }}>
            Fikaprenumerationen löper tills vidare utan bindningstid. Inför varje leverans skapas
            en vanlig order med faktura enligt valt intervall, några dagar före leveransdagen. Ni
            pausar, ändrar eller avslutar när ni vill genom att svara på bekräftelsemejlet; en
            ändring som meddelas efter att en order redan skapats gäller från nästa leverans.
            Priset per leverans följer aktuellt pris och framgår av varje faktura.
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
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Force majeure</h2>
          <p style={{ margin: 0 }}>
            Vi ansvarar inte för försening eller utebliven leverans som beror på omständigheter
            utanför vår kontroll, såsom extremt väder, trafikstopp, strejk, myndighetsbeslut eller
            leverantörsbrist. Vi meddelar er så snart vi kan och erbjuder ny leveransdag eller
            kreditering.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Ändringar och tvist</h2>
          <p style={{ margin: 0 }}>
            Vi kan ändra dessa villkor; den version som gäller för en beställning är den som var
            publicerad när beställningen lades. Svensk rätt tillämpas och tvist prövas av allmän
            domstol.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Säljare</h2>
          <p style={{ margin: 0 }}>
            {invoiceConfig.companyName}, org.nr {invoiceConfig.orgNumber},{" "}
            {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}.
            {isVerifiedValue(invoiceConfig.vatNumber) ? ` Momsreg.nr ${invoiceConfig.vatNumber}.` : ""}
            {isVerifiedValue(invoiceConfig.email) ? (
              <>
                {" "}E-post: <a href={`mailto:${invoiceConfig.email}`}>{invoiceConfig.email}</a>.
              </>
            ) : null}
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
