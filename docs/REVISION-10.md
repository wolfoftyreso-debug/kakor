# Revision 10 – ifrågasatte revision 9 9 september 2026

Revision 9 hade rätt i cutoff och lagerläckage. Den hade fel i att arbetet
var klart. Den här omgången testade kassa, prenumeration, lager, faktura,
copy och SEO mot den levande sajten och mot A/B/C på riktigt.

## Vad revision 9 lämnade trasigt

### P0 – kassan stängde torsdagen i öppna flikar
SSR skrev in den *sänkta* framförhållningen (0 på onsdag) som `leadTimeDays`.
Klienten räknade om datum med det frysta talet. En flik öppen från måndag
till tisdag dolde torsdagen trots att cutoff inte infallit.
Kassan skickar nu den konfigurerade framförhållningen (2) och räknar
effektiv lead live med `leadTimeAllowingNextDelivery`.

### P0 – prenumerationsretry skapade ett andra avtal
`generateDue` flyttar `nextDeliveryDate`. Samma idempotensnyckel jämfördes
sedan mot första leveransdagen, blev `IDEMPOTENCY_MISMATCH`, klienten
roterade nyckeln och startade `PREN-1002`. Jämförelsen ignorerar numera
nästa datum. Generatorn körs även vid retry (den är idempotent).

### P0 – testkörningen låste kassan
A/B/C-skriptet lämnade veckan låst. Onsdag förmiddag kunde kunden inte
beställa till *den* torsdagen. Skriptet öppnar veckor vars cutoff inte
infallit, före och efter testet.

### P1 – paketvikt följde live-produkten
`OrderItem` snapshotade pris och namn, inte `packageWeightGrams`. Plock,
lager och kapacitet vägde om när admin ändrade prova-på-paketet.
Kolumnen finns nu på raden; `gramsForLine` föredrar snapshoten.

### P1 – övrigt som faktiskt gick sönder
- Efterhandsändringar: sista skrivningen vann. CAS + retry, och `LOCKING`
  räknas som förseglad.
- Lås-CAS som förlorade OPEN→LOCKING rapporterade succé. Förloraren kör
  `finalizeLock` om status är LOCKING; admin får fel om veckan inte är låst.
- Cutoff kollades före transaktionen. Engångsköp kollar låst vecka inuti tx.
- Delkredit minskade inte plockmängd. Plock använder återstående fakturarad;
  avplock återställer exakt det som drogs.
- PDF-underlag på låst vecka utan snapshot byggde om från live-data. 409.
- COMPLETED-vecka släppte inte in sena ordrar i statusen. `syncWeekStatus`
  kan lyfta tillbaka till PICKING.
- Prenumerationskapacitet utan radlås. Samma `updateMany`-lås som kassan.
- Avbruten order behöll idempotensnyckeln – retry returnerade den döda
  ordern. Nyckeln nollställs vid avbrott.
- `postalCode: "135"` i JSON-LD (inte ett svenskt postnummer).
  `postalCodePrefix` istället.
- “Nybakad produktion” i lagerjustering (policy).
- “Vi bakar vinnaren” / “Vi bakar i begränsade mängder” (de bakar inte).
- Villkor och /om lovade automatiskt leveransstopp vid förfallen faktura.
  Koden flaggar bara. Copy matchar koden.

## Acceptans A/B/C – kört om

21/21 PASS i `scripts/e2e/warehouse-revision.mts` (inklusive retry-nyckel
och att veckan öppnas igen före cutoff). Live kassa 9 sep förmiddag:
torsdag 10 september syns, `leadTimeDays` i payload är 2.

SEO-crawl: 21 URL:er, 0 fel, områdessidor högst 26 % delad text.
Enhetstester utan Postgres: 83/83.
Typecheck: 0 nya fel (befintligt grok-pwa).

## Medvetet orört

- `InStock` kopplas inte till fryssaldo. Beställning tas emot även vid
  underskott (produktionsbehov). Merchant listings är inte live.
- 1957 i sigill/hero är ägarbeslut, inte `foundingDate` (schema säger 2025).
- CSV-export GET: `SameSite=lax` räcker; ingen CSRF-exfil via img.
- Engelska / hreflang, ISR, GBP, domän, bankgiro.

## Ägarsteg (samma som förut)

Domän, Search Console, Bing, Google Business Profile, bankgiro, momsnummer,
telefon, fakturamejl.
