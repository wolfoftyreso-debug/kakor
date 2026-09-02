# Sockerbagaren.se

Företagsfika i södra Stockholm: klassiska småkakor (mandelkubb, kolasnittar,
chokladsnittar) sålda per kilo till företag i Tyresö, Nacka, Haninge och
Huddinge. **Betalning sker alltid mot faktura** — ingen betalprocessor.

En modulär monolit: Next.js (App Router) + TypeScript + Prisma +
PostgreSQL. Target-miljö: **GitHub → Vercel → Neon PostgreSQL** —
driftmanualen finns i [DEPLOYMENT.md](DEPLOYMENT.md).
Designpaketet i [`design/`](design/) är source of truth för UI/UX.

## Komma igång

```bash
npm install
cp .env.example .env          # lokala defaultvärden pekar på dev-databasen
npm run dev:db                # lokal PostgreSQL + migrations + seed (egen terminal)
npm run dev                   # http://localhost:3000
```

Fungerar från helt tom databas — migrations + seed är hela uppsättningen.
(Alternativ: peka `DATABASE_URL`/`DIRECT_DATABASE_URL` mot en egen
Neon-utvecklingsdatabas.)

## Skript

| Kommando | Gör |
|---|---|
| `npm run dev` / `build` / `start` | utveckling / produktion |
| `npm run dev:db` | lokal PostgreSQL (inbäddad) med migrations + seed |
| `npm test` | Vitest mot inbäddad PostgreSQL, migrerad från tom databas |
| `npm run check` | typecheck + lint + tester (samma som CI) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run db:migrate` | kör migrations (`prisma migrate deploy`) |
| `npm run db:seed` | seed (idempotent — rör aldrig befintlig data) |
| `npm run admin:create` | skapa/uppdatera admin från `ADMIN_EMAIL`/`ADMIN_PASSWORD` |
| `npm run subscriptions:generate` | generera förfallna prenumerationsordrar (idempotent) |

## Arkitektur

```
src/lib/            affärslogik (den enda auktoriteten för pris/moms/nummer)
  orders/           ordermotorn: order + faktura atomiskt, e-post efteråt
  subscriptions/    prenumeration -> genererar vanliga ordrar via ordermotorn
  invoice/          fakturasnapshot (immutable) + PDF-rendering (pdfkit)
  email/            provider-abstraktion (resend | log) + EmailLog
  auth/             scrypt-lösenord + DB-sessioner (HttpOnly-cookie)
src/app/(site)/     publika sidor (startsida, /bestall, /prenumeration, områden)
src/app/admin/      admin (server-side skyddat) + server actions
src/app/api/        POST /api/orders, /api/subscriptions, cron-endpoint
prisma/             schema, migrations, seed
tests/              Vitest (körs mot inbäddad PostgreSQL, tom DB per körning)
```

Viktiga principer:

- **Belopp i öre (heltal), moms i baspunkter** (livsmedel 12 % = 1200). All
  beräkning i `src/lib/money.ts` — ingen ekonomi i React-komponenter.
- **Servern räknar alltid om priset** från databasen; klienten skickar bara
  produkt-id + antal. Okända fält avvisas av zod-scheman.
- **Två försäljningsenheter** (`Product.unit`): `kg` (lösvikt per helt kilo)
  och `paket` (styckvara, t.ex. prova-på-paketet på 1,5 kg — pris per paket).
  Beloppsmatematiken är identisk (antal × á-pris i öre); enheten följer med
  orderrad, faktura-snapshot, PDF och mejl. `packageWeightGrams` ger sanna
  viktsummor i kassa och leveransvy.
- **Order + faktura skapas i samma transaktion.** E-post skickas efter commit
  och kan aldrig fälla ordern; resultatet loggas i `EmailLog`.
- **Fakturan är ett historiskt dokument**: hela dess innehåll ligger som
  snapshot (`Invoice.snapshotJson`). Senare pris-/produkt-/kundändringar
  påverkar aldrig utfärdade fakturor. PDF renderas enbart från snapshoten.
- **Nummerserier** (dokumenterade i `src/lib/numbering.ts`): order `SB-100001…`,
  faktura `10001…`, prenumeration `PREN-1001…`. Räknas upp atomiskt i samma
  transaktion — kollisionssäkert.
- **Separata statusar**: order NEW/CONFIRMED/CANCELLED, betalning UNPAID/PAID,
  leverans PENDING/DELIVERED. "Förfallen" lagras aldrig — den härleds ur
  `dueDate < idag AND UNPAID`.
- **Dubbelbeställningsskydd**: klienten skickar en idempotensnyckel;
  unikhetsvillkor i databasen gör att dubbelklick/retry returnerar samma order.
- **Leveransdagar är data**: per område konfigureras veckodagar (1–7),
  framförhållning och ev. postnummerprefix i admin → Inställningar. Passerade
  eller för nära datum erbjuds aldrig.

## Admin

- `/admin/login` → `/admin` (översikt), Beställningar, Fakturor (reskontra),
  Leveranser (mobilanpassad arbetsvy), Prenumerationer, Produkter, Inställningar.
- Sessioner: HttpOnly + SameSite + Secure (prod), 12 h livslängd, hashade
  tokens i DB. Rate limiting på login. Ingen publik registrering.
- Första admin skapas av seed från `ADMIN_EMAIL`/`ADMIN_PASSWORD` (endast om
  ingen admin finns), eller när som helst med `npm run admin:create`.

## Fakturor

- Skapas automatiskt med ordern; förfallodatum = fakturadatum +
  `INVOICE_PAYMENT_TERMS_DAYS` (default 30).
- Kunden når PDF:n via en 48-teckens slumpad token: `/faktura/<token>`
  (noindex, ej gissningsbar). Skickas även som PDF-bilaga i fakturamejlet.
- Admin kan ladda ner, skicka igen och markera betald (reskontran).

## E-post

`EMAIL_PROVIDER` väljer provider utan att orderlogiken ändras:

- `log` (default): skickar inget, loggar bara — för utveckling/test.
- `resend`: skickar via Resend API (`RESEND_API_KEY`, verifierad domän i
  `EMAIL_FROM`).

Alla utskick loggas i `EmailLog` (status SENT/FAILED). Ordern skapas alltid
först — e-postfel förlorar aldrig en order.

## Prenumerationer

Prenumeration = instruktion som genererar **vanliga ordrar** (med vanliga
fakturor) via samma ordermotor.

I frontend är prenumeration INTE ett eget flöde: sajten har EN funnel
(`/bestall` — Kakor → Leverans → Uppgifter → Kontrollera) och EN varukorg,
där köpläget (engång/återkommande + intervall) väljs i leveranssteget och
sparas på korgen (`purchaseMode`/`recurrenceInterval` i cart-contexten).
Submit grenar mot `/api/orders` respektive `/api/subscriptions`.
`/prenumeration` är en förklarande sida som skickar in kunden i funneln
med återkommande förvalt (`/bestall?typ=aterkommande`). Generering:

- Automatiskt: Vercel Cron (schema i `vercel.json`) anropar
  `GET /api/cron/generate-subscription-orders` dagligen med
  `Authorization: Bearer $CRON_SECRET`. Idempotent — samma period kan aldrig ge två ordrar
  (unikhetsvillkor på subscription + period).
- Manuellt: knappen "Generera kommande prenumerationsleveranser" i admin,
  eller `npm run subscriptions:generate`.

## Environment variables

Se [`.env.example`](.env.example). Sammanfattning:

| Variabel | Beskrivning |
|---|---|
| `DATABASE_URL` | Neon poolad anslutningssträng (runtime) |
| `DIRECT_DATABASE_URL` | Neon direkt anslutningssträng (endast migrations) |
| `SITE_URL` | publik bas-URL (länkar i mejl, sitemap, canonical) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | bootstrap av första admin (seed/CLI) |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` | e-post |
| `INVOICE_*` | juridiska fakturauppgifter (se nedan) |
| `CRON_SECRET` | skyddar cron-endpointen |

## Deployment (GitHub → Vercel → Neon)

Deployment sköts av Vercels Git-integration: push till produktionsbranchen
= production deploy, övriga branches/PRs = Preview Deployments (noindexade,
med e-postspärr och egen preview-databas). Migrations körs separat med
`prisma migrate deploy` mot `DIRECT_DATABASE_URL` — aldrig från runtime.
PDF-generering (pdfkit) är ren Node och verifierad i Vercels serverless-
runtime. Fullständig driftmanual — Neon-anslutningar, miljöer, cron,
rollback, smoke tests: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Sök & synlighet (SEO/GEO)

- **Schema-motor** (`src/lib/seo/schema.ts`): all JSON-LD genereras centralt
  från riktig applikationsdata med stabil `@id`-strategi
  (`/#organization`, `/#website`, `{url}#webpage`, `{url}#breadcrumbs`,
  `/#product-{slug}`) och kopplas till EN graf — inga lösa snippets i
  komponenter. Regel: inga påhittade egenskaper (ratings, öppettider,
  telefon osv. läggs till först när verksamheten verifierat dem).
- **Brödsmulor**: synlig rad och `BreadcrumbList` byggs från samma datalista
  (`InfoPageSeo`/`Breadcrumbs`) så att de aldrig divergerar.
- **Metadata**: canonical på alla indexerbara sidor, OG/Twitter-defaults med
  varumärkes-OG-bild (`public/og.png` — genererad brand-grafik, inget
  fejkfoto). Admin och fakturor är noindexade; `/faktura` blockeras i robots.
- **dateModified** sätts endast vid verklig innehållsändring (manuell
  konstant på villkor/integritet) — aldrig per deploy.
- **Google Preferred Sources**
  (`src/components/preferred-source/PreferredSourceCTA.tsx`): Googles
  officiella knapp (`news.google.com/swg/js/v1/publisher.js` +
  `[google-add-preferred-source-btn]`, `data-lang="sv"`) plus officiell
  deeplink `google.com/preferences/source?q=<domän>` som script-fri reserv.
  Visas efter levererat värde (order-/prenumerationsbekräftelse), laddas
  lazy (ingen LCP-påverkan), sajten fungerar oavsett om Googles script
  laddar. Env-gated via `NEXT_PUBLIC_PREFERRED_SOURCES` — ska vara `true`
  ENDAST i produktion (ingen staging-läcka). Klick ≠ bekräftelse: endast
  `preferred_source_impression`/`preferred_source_click` mäts, ingen
  "confirmed"-händelse fejkas. Vid ev. framtida CSP: tillåt script från
  `news.google.com`.
- **Analytics**: GA4 laddas endast om `NEXT_PUBLIC_GA4_ID` är satt
  (anonymize_ip, inga annonssignaler). `track()` i `src/lib/analytics.ts`
  är no-op utan GA — mätning kan aldrig fälla sajten. Ingen PII i event.
- **Checklista vid lansering**: verifiera domänen i Google Search Console
  och skicka in `/sitemap.xml`; kontrollera att sajten dyker upp i Googles
  källinställningsverktyg (krav för Preferred Sources-knappen); validera
  JSON-LD i Rich Results Test.
- Anteckning: `developers.google.com` var inte nåbar från byggmiljön —
  Preferred Sources-implementationen följer den officiella dokumentationens
  mönster verifierat via flera oberoende källor (aug 2026) och bör
  stämmas av mot
  `developers.google.com/search/docs/appearance/preferred-sources`
  vid lansering.

## KVARVARANDE VERKSAMHETSDATA

Allt detta är samlat i `.env` (via `src/lib/config.ts`) och tydligt markerat
`[EJ VERIFIERAT]` tills verksamheten bekräftat — **inget av det är påhittat**:

- Faktura-e-post, telefonnummer
- Bankgironummer och momsregistreringsnummer (visas på fakturan).
  **Skydd:** fakturans PDF skriver aldrig ut `[EJ VERIFIERAT]`-platshållare
  (bankgiro-raden blir "Betalningsuppgifter meddelas separat", overifierad
  e-post/telefon/momsnr utelämnas), och i produktion (`VERCEL_ENV=production`)
  rapporterar `checkEnv()` saknade `INVOICE_BANKGIRO`/`INVOICE_VAT_NUMBER`/
  `INVOICE_EMAIL` som KRITISKA vid uppstart — sätt dem innan första riktiga ordern.
- **Slutliga priser** — seedade 295 kr/kg är ett startvärde som ska bekräftas
  eller ändras i admin → Produkter (historiska ordrar påverkas inte)
- **Produktetikett** (`Product.badge`, t.ex. "Bästsäljare") visas på
  produktkort, produktsida och som flytande kort på startsidans hero — sätts
  per produkt i admin → Produkter; tom = ingen etikett. Kolasnittar seedas
  med "Bästsäljare" (verksamhetens uppgift).
- Leveransdagar: endast TORSDAG just nu (verksamhetens uppgift aug 2026,
  seedad och migrerad); ändras i admin → Inställningar när fler dagar
  tillkommer
- Adresser BEKRÄFTADE av verksamheten: kontoret på Antennvägen 2
  (= fakturaadressen i `.env`/footer) och lagret på Radiovägen 19,
  c/o Mewab Ängelsholmsglass, Tyresö (används i områdestexterna)
- Foton i `public/images/`: produktfoton (mandelkubb, kolasnittar,
  chokladsnittar), hero med alla tre sorterna, OG-beskärningar samt
  RÅVARUSERIEN komplett och enhetlig (smör, strösocker, vetemjöl, mandel,
  choklad — samma fotoserie) samt SAMTLIGA miljöbilder från designpaketets
  shot list: LEVERANS (budet med kartong vid leveransbilen — /leverans och
  områdessidorna), BAKNING (bagaren vid plåten — /om)
  och ARBETSPLATSFIKA (kollegorna vid fikabordet — startsidans "Fika för
  arbetsplatser") samt PAKETFOTOT för prova-på-paketet (alla tre sorterna
  på fat). Hela fotouppsättningen enligt designpaketet är därmed komplett.
- Google-recensioner: sektionen renderas inte förrän verifierade omdömen
  kopplas in (inga fejkade recensioner, även enligt designpaketet)
