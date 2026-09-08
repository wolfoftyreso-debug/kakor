import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { ImageSlot } from "@/components/ImageSlot";
import { invoiceConfig, isVerifiedValue } from "@/lib/config";
import { InfoPageSeo } from "@/components/InfoPageSeo";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: { absolute: "Om Sockerbagaren – det började med en gammal bok" },
  description:
    "Sockerbagaren började med ett ärvt exemplar av Svenskt konditorlexikon. Gamla recept, riktiga råvaror, ett litet konditori som bakar för hand och den sista biten gjord i Tyresö. Tiffany Svensson berättar.",
  alternates: { canonical: "/om" },
  ...sharePreview({
    title: "Om Sockerbagaren – det började med en gammal bok",
    description:
      "Gamla recept, riktiga råvaror, ett litet konditori som bakar för hand och den sista biten gjord i Tyresö. Tiffany Svensson berättar.",
    path: "/om",
    image: { url: "/images/bakning.jpg", alt: "Chokladsnittar läggs upp på plåt" },
  }),
};

export default function OmPage() {
  return (
    <>
    <InfoPageSeo
      path="/om"
      name="Om Sockerbagaren"
      title="Om Sockerbagaren – det började med en gammal bok"
      description={String(metadata.description)}
    />
    <div className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
      <PageHeader
        eyebrow="Om oss"
        title="Det började med en gammal bok"
        lede="Sockerbagaren började inte med en affärsidé. Det började med ett ärvt exemplar av Svenskt konditorlexikon – och en tanke om att en liten del av den svenska fikatraditionen förtjänar att göras ordentligt."
        facts={[
          { label: "Recept", value: "Svenskt konditorlexikon 1957" },
          { label: "Bakas", value: "Litet konditori i Litauen" },
          { label: "Packas", value: "Radiovägen, Tyresö" },
          { label: "Betalning", value: "Alltid mot faktura" },
        ]}
      />
      <figure>
        <div className="media">
          <ImageSlot label="Chokladsnittar läggs upp på plåt" src="/images/bakning.jpg" />
        </div>
        <figcaption>Chokladsnittar på plåt – kakorna bakas i omgångar och packas för leverans i Tyresö.</figcaption>
      </figure>

      <p>
        När min gammelmormor gick bort ärvde jag Svenskt konditorlexikon, en gammal bok om svensk
        konditortradition som hade funnits i familjen länge. Min gammelmormor och gammelmorfar drev
        själva konditori, och konditorihantverket var en stor del av deras liv.
      </p>
      <p>
        När jag började läsa i boken fastnade jag för hur otroligt noggrant allting var beskrivet.
        Recepten såklart, men också själva yrket. Det märks att det fanns en enorm stolthet i att
        vara konditor. Det var ett riktigt hantverksyrke, med kunskap, regler och traditioner som
        man förväntades kunna och respektera.
      </p>
      <p>
        Jag tyckte att det var väldigt fint. Och samtidigt lite synd att så mycket av den kunskapen
        riskerar att försvinna. Där någonstans föddes tanken på Sockerbagaren.
      </p>

      <h2>Gamla recept ska fortfarande smaka som gamla recept</h2>
      <p>
        Min idé är egentligen ganska enkel: jag vill ta hand om en liten del av den svenska
        fikatraditionen och försöka göra den ordentligt.
      </p>
      <p>
        Vi har därför gått tillbaka till äldre recept och metoder och försökt följa dem så nära det
        är praktiskt möjligt. Inte göra en modern kaka som påminner om originalet, utan försöka
        förstå hur den faktiskt ska bakas, smaka och kännas.
      </p>
      <p>
        När vi sedan började leta efter någon som kunde baka åt oss upptäckte vi att det inte var så
        enkelt som att bara hitta en stor kakfabrik. Vi letade runt i Europa och kom till slut till
        Litauen, där det fortfarande finns väldigt mycket kunskap kring den här typen av bageri- och
        konditorihantverk. Vi kontaktade flera olika bagerier innan vi hittade ett litet konditori
        som passade det vi ville göra.
      </p>
      <p>
        Det är en liten verksamhet med bara några få personer. De kan producera i större mängder,
        men mycket av arbetet görs fortfarande på ett sätt som känns mer som ett bageri än en
        fabrik. Kakorna bakas hos dem, och mycket görs för hand i stället för att allt formas och
        stansas fram i stora automatiserade produktionslinjer. Det var precis den kombinationen vi
        letade efter.
      </p>

      <h2>Från Litauen till Tyresö</h2>
      <p>
        När kakorna är färdigbakade kyls och fryses de snabbt och transporteras till Sverige. De
        kommer till vårt lager på Radiovägen i Tyresö, där vi gör den sista delen själva:
        kontrollerar, packar om och färdigställer beställningarna innan de går ut till kunderna.
      </p>
      <p>
        Just frysningen är faktiskt också en del av historien. Min gammelmormor frös alltid sina
        småkakor direkt efter bakningen. När man sedan tog fram dem smakade de som nya igen. Det är
        ett gammalt knep som fungerar väldigt bra just med småkakor. Därför gör vi på ungefär
        samma sätt, fast i en modern leveranskedja: kakorna tinar på väg till er och är redo att
        ställas fram när de kommer.
      </p>
      <p>
        Sedan börjar nästan en annan del av upplevelsen. En småkaka förändras lite med tiden. Vissa
        tycker bäst om den direkt, andra när den har fått ligga några dagar. Förvarar man den helt
        tätt behåller den mer av sin mjukhet, medan den blir torrare och sprödare om den får lite
        mer luft. Det finns inget märkvärdigt i det. Det är bara så riktiga kakor fungerar.
      </p>

      <h2>Riktiga råvaror. Inga genvägar.</h2>
      <p>
        En sak som varit viktig för mig från början är råvarorna. Om man ska baka efter gamla
        recept tycker jag också att man ska använda riktiga råvaror. Därför använder vi smör –
        aldrig margarin. Vi försöker undvika artificiella ersättningar och onödiga genvägar och
        väljer i stället bra, traditionella ingredienser. Så långt det är möjligt väljer konditoriet
        som bakar åt oss råvaror från lokala producenter och gårdar.
      </p>
      <p>
        För mig handlar det inte om att göra kakorna märkvärdigare än de är. Tvärtom. Mjöl ska vara
        bra mjöl. Smör ska vara riktigt smör. Ägg ska vara riktiga ägg. Choklad ska vara bra
        choklad. Det är ungefär så jag tror att min gammelmormor hade resonerat också. En småkaka
        består inte av särskilt många ingredienser. Då finns det heller ingenstans för dåliga
        råvaror att gömma sig. Hela listan finns under{" "}
        <Link href="/ingredienser">ingredienser och allergener</Link>.
      </p>

      <h2>Sockerbagaren är mitt skolprojekt – men också något mer</h2>
      <p>
        Jag heter Tiffany Svensson och går ekonomi-juridik på Nacka gymnasium. Sockerbagaren
        började som mitt skolprojekt och drivs genom min pappas företag, {invoiceConfig.companyName}.
        För mig har det blivit ett sätt att kombinera det jag lär mig om företagande med något som
        redan fanns i min familj långt innan jag föddes.
      </p>
      <p>
        Jag vet inte exakt vad Sockerbagaren kommer att vara om tio år. Men jag vet vad jag vill
        att det ska stå för i dag. Att gamla recept är värda att bevara. Att hantverk och
        yrkeskunskap betyder någonting. Att en enkel småkaka faktiskt kan ha en historia. Och
        framför allt att den fortfarande ska smaka riktigt, riktigt gott.
      </p>
      <p style={{ fontStyle: "italic" }}>
        Tiffany Svensson
        <br />
        Sockerbagaren
      </p>

      <h2>Så beställer ni</h2>
      <p>
        Vi säljer till företag: kontor, verkstäder, byggföretag, kliniker och butiker i Tyresö,
        Nacka, Haninge och Huddinge. Välj sorter och mängd per kilo (eller prova-på-paketet på
        1,5 kg), välj leveransdag för ert område och ange faktureringsuppgifter – fakturan skapas
        direkt och förfaller först efter leveransen. Återkommande fika?{" "}
        <Link href="/prenumeration">Fikaprenumerationen</Link> gör om samma beställning automatiskt.
        Läs mer i vår <Link href="/fika-till-jobbet">guide till fika på jobbet</Link>.
      </p>
      <h2>Företagsuppgifter</h2>
      <p style={{ lineHeight: 1.8 }}>
        {invoiceConfig.companyName}
        <br />
        Org.nr {invoiceConfig.orgNumber}
        <br />
        Kontor: {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}
        <br />
        Lager: Radiovägen 19, Tyresö (c/o Mewab)
        {/* Kontaktvägar visas när verksamheten verifierat dem – platshållare
            renderas aldrig publikt. */}
        {isVerifiedValue(invoiceConfig.email) && (
          <>
            <br />
            <a href={`mailto:${invoiceConfig.email}`}>{invoiceConfig.email}</a>
          </>
        )}
        {isVerifiedValue(invoiceConfig.phone) && (
          <>
            <br />
            <a href={`tel:${invoiceConfig.phone.replace(/[^\d+]/g, "")}`}>{invoiceConfig.phone}</a>
          </>
        )}
      </p>
      <div className="actions">
        <Link href="/bestall" className="btn btn-primary">
          Beställ kakor
        </Link>
        <Link href="/bestall?typ=aterkommande" className="btn btn-butter">
          Starta fikaprenumeration
        </Link>
      </div>
    </div>
    </>
  );
}
