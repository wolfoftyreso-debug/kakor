# Överlämning – Sockerbagaren.se

Skriven 9 september 2026 efter 100 commits. Läs den här filen först, sedan `README.md` (system och drift) och `DEPLOYMENT.md` (Vercel, Neon, miljövariabler).

## 1. Vad det är

B2B-webshop för Sockerbagaren: gammaldags svenska småkakor på riktigt smör som säljs **per kilo** (Kolasnittar = bästsäljare, Mandelkubb, Chokladsnittar) och **per paket** (Prova-på-paket 1,5 kg) till företag i **Tyresö, Nacka, Haninge och Huddinge**. Betalning **endast mot faktura** (30 dagar från leverans). Fasta leveransdagar per område (just nu **torsdagar** – data i admin, aldrig hårdkodat). Engångsköp eller fikaprenumeration (varje/varannan/var fjärde vecka, ingen bindningstid).

Verksamheten drivs av **Landvex AB** (Antennvägen 2, Tyresö). Grundare **Tiffany Svensson** (ekonomi-juridik, Nacka gymnasium); Sockerbagaren är hennes skolprojekt. Kakorna bakas och förpackas hos ett **litet konditori i Šiauliai, Litauen**, fryses direkt efter bakningen, körs frysta till **fryslagret på Radiovägen 19, Tyresö (hos Mewab och Engelholmsglass)** och plockas där. Leverans **själva eller med anlitat bud**, under dagen, till bemannad företagsadress. Recept ur den ärvda boken **Svenskt konditorlexikon**; hero-texten säger "recept från Svenskt konditorlexikon 1957" och sigillet "RECEPT 1957 · SÖDRA STOCKHOLM" (årtalet är ägarens val, fortfarande en öppen fråga). Företaget finns **sedan 2025**.

## 2. Regler som alltid gäller

- **Hitta aldrig på affärsfakta.** Bankgiro, momsnummer, telefon och fakturamejl är `[EJ VERIFIERAT]`-platshållare i env och renderas aldrig publikt (`isVerifiedValue` i `src/lib/config.ts`). Inga fejkade recensioner, betyg, öppettider, adresser eller siffror – inte i text, inte i schema.
- Kakorna **bakas i satser**. Skriv aldrig "bakas på beställning", "nybakat" eller "hembakat". Kalla aldrig konditoriet "vårt bageri". Ingrediensen heter "keltiskt salt". Smör, aldrig margarin.
- **Säg aldrig "kontakta oss"** i säljflödet (det finns ingen verifierad kontaktväg). "Svara på mejlet" efter köp är ok.
- Leveransdagar, framförhållning, postnummerserier, kapacitet, priser, moms (6 % till 2027-12-31) och antal kakor per kilo styrs i **admin**, inte i kod.
- Kund med **förfallen obetald faktura**: systemet flaggar i admin och i orderaviseringen, men blockerar **inte** automatiskt (ägarbeslut).
- **Domänen sockerbagaren.se kopplas SIST.** Demo körs på Vercel-adress.
- Pusha bara till `claude/sockerbagaren-full-build-e2ebkd` och `demo-testdeploy`. **Aldrig till `main`** utan uttryckligt ok. Inga pull requests. Inga modell-ID:n i repot.
- Varje ändring: implementera → verifiera (typecheck, lint, vitest, E2E, SEO-crawl) → committa med **svenskt** meddelande → pusha → merga till demo → vänta på deploy → verifiera live → rapportera med demo-URL och nytt admin-lösenord.

## 3. Grenar och deploy

| Gren | Roll |
|---|---|
| `claude/sockerbagaren-full-build-e2ebkd` | Utvecklingsgren. Allt arbete sker här. HEAD: `bf9810d`. |
| `demo-testdeploy` | Demo-gren = feature-grenen + `vercel.json` med `"buildCommand": "npm run build:demo"` (SQLite-databas byggs vid deploy, `scripts/build-demo-db.ts` kör `prisma/seed.ts`). Behåll den raden vid merge. HEAD: `292b445`. |
| `main` | Orörd sedan tidigare. |

Merge-rutin: `git checkout demo-testdeploy && git reset --hard origin/demo-testdeploy && git merge --no-edit claude/sockerbagaren-full-build-e2ebkd && git push origin demo-testdeploy`, tillbaka till feature-grenen.

Vercel: team `hypbit` (`team_GP2MTfBKmxj8ajYLvQtV7clA`), projekt `sockerbagaren` (`prj_1R3vBDCRSTFfkVrRrd9MFpdxVBRX`). Demo: <https://sockerbagaren-git-demo-testdeploy-hypbit.vercel.app>. Varje demodeploy roterar admin-lösenordet – det står i bygglogen på raden `DEMO-ADMIN LÖSENORD:` (admin: `/admin`, `demo-admin@sockerbagaren.se`). Senaste: `demo-RMT_b5Fk5dEP` (deploy `dpl_HUREdGVAPyPg1GzGFtdZKxJVZ4hv`). Demodatabasen är flyktig.

Produktion (när det blir aktuellt): Neon PostgreSQL, `scripts/vercel-build.mjs` kör `prisma migrate deploy` när `DIRECT_DATABASE_URL` finns i byggmiljön. Se `DEPLOYMENT.md`.

## 4. Stack och struktur

Next.js 16.3 (App Router, Turbopack, `src/proxy.ts`), React 19, TypeScript strict, Prisma 6.19 + PostgreSQL (SQLite på demo), Zod 4 (sv), ESLint flat (7 kända varningar, 0 fel), pdfkit för fakturor, Resend för e-post (`EMAIL_PROVIDER=log` lokalt), Sentry (env-styrt), GA4 (bara när `NEXT_PUBLIC_GA4_ID` finns, med samtyckesbanner). Belopp i **öre** (heltal), moms i baspunkter.

```
src/app/(site)/         publika sidor: /, /kakor, /kakor/[slug], /bestall (kassan), /prenumeration,
                        /prenumeration/hantera/[token] (självservice), /leverans, /[omrade] (tyreso…),
                        /fika-till-jobbet, /julfika, /folkets-kaka, /ingredienser, /om, /villkor, /integritet
src/app/admin/          inloggning, ordrar, reskontra, leveranser (körlista, veckovy, plock, följesedel, historik), lager, prenumerationer,
                        produkter (+ etiketter), områden, omröstningar, CSV-export, cutoff för leveranslåsning
src/app/api/            order, cron (generate-subscription-orders, delivery-reminders, lock-delivery-weeks), polls, health
src/app/llms.txt/       maskinläsbar företagsbeskrivning för AI-sök
src/lib/                orders/ (skapa, faktura, kredit, mejl, overdue), subscriptions/ (service, manage,
                        emails), polls/, seo/ (schema.ts = JSON-LD-motor med @id, meta.ts, content-dates.ts),
                        capacity.ts, dates.ts (helgdagar, leveransdagar), area-content.ts, config.ts, money.ts
src/components/         ProductCard, ProductBuyBox, ImageSlot, Breadcrumbs, FaqList, poll/, admin/
prisma/                 schema, migrations (hand-skrivna SQL-mappar + migrate deploy), seed.ts
scripts/                e2e/full-flow.mts (92 kontroller), seo-crawl.mts, smoke.ts, build-demo-db.ts
tests/                  vitest, 138 tester
.github/workflows/      ci.yml (typecheck, lint, test, build), e2e.yml (måndagar: E2E + seo:crawl)
```

Kassan (`src/app/(site)/bestall/CheckoutFlow.tsx`): fem steg Kakor → Leverans → Uppgifter → Kontrollera → Tack, sessionStorage för korg och kvitto, localStorage för sparade företagsuppgifter (opt-in), mängdhjälp (3–5 kakor/person), postnummerkontroll mot områdets serier, Luhn på org.nr, rate limits, idempotensnyckel, prisspärr.

Fakturor: skapas vid order, PDF via token-länk (`/faktura/[token]`), förfallodag N dagar från leverans, kreditfakturor (hel/del), statusnot på PDF, betalningsuppgifter utelämnas tills bankgiro är verifierat.

Prenumerationer: cron skapar ordrar inför varje leverans, snäpper förbi helgdagar och spärrade/fulla dagar, kunden hanterar via personlig länk (pausa, återuppta, hoppa över, ändra, avsluta), prismejl vid prisändring.

Folkets nästa småkaka (`/folkets-kaka`): generisk omröstningsmodell (Poll, PollCandidate, PollVote, PollWinnerSignup). Omgång 1: Hallongrotta, Dröm, Schackruta, stänger Luciadagen 13 dec 2026 23:59 svensk tid (server-side). Resultat visas bara efter röst. Admin under `/admin/omrostningar`.

## 5. Köra lokalt

```bash
npm ci
npm run dev:db                     # inbäddad PostgreSQL på 127.0.0.1:55432 (startas om efter containeromstart)
export DATABASE_URL=postgresql://postgres:postgres@localhost:55432/sockerbagaren
export DIRECT_DATABASE_URL=$DATABASE_URL
npx prisma migrate deploy && npx tsx prisma/seed.ts
npm run build && PORT=3122 CRON_SECRET=revisionshemlighet ADMIN_NOTIFY_EMAIL=admin@example.test npm start
```

Verifiering (allt ska vara grönt före push):

```bash
npm run typecheck && npm run lint && npm test          # 138/138
CHROMIUM_PATH=<chromium> E2E_CRON_SECRET=revisionshemlighet npx tsx scripts/e2e/full-flow.mts   # 92/92
npm run seo:crawl                                        # 0 fel
```

Fällor: vitest kan stänga dev-databasen (starta om med `npm run dev:db`); rate limits ligger i minnet per serverprocess (starta om servern och `delete from "RateLimitBucket"` före E2E); `prisma migrate dev` kräver TTY – skriv migrations-SQL för hand och kör `migrate deploy`; stoppa servern med `pgrep -f "^next-server"`, inte `pkill -f "next start"`.

## 6. Var vi står (9 sep 2026)

Senaste omgångarna, alla live på demon:

1. Kundgranskning sex (41 fixar), topp 10 varav fyra byggda (mängdhjälp, sparade uppgifter, leveranspåminnelse, prismejl).
2. Självservice för prenumeranter via personlig länk.
3. Folkets nästa småkaka, hela funktionen.
4. Berättelsen på /om i Tiffanys röst (två texter sammanvävda), ursprung Šiauliai på etikett, produktsida, FAQ; leveranskedjan korrekt överallt.
5. Mobil symmetri: stepper centrerad, kassabar utan kapning, etikett som täckte produktbilden lagad, köpruta, områdeskort.
6. SEO-revision fem: crawl, sökordsuniversum, intent-karta; områdessidorna omskrivna (68 % → 30 % delad text), leveranssidan utbyggd, H1/brödsmulor på /prenumeration, kortare beskrivningar, bildstorlekar, `foundingDate`, `/llms.txt`, `npm run seo:crawl` i CI.
7. SEO-revision sex: fraktmål i Product-schema = fyra kommuner (inte hela Sverige), Twitter-kort på startsidan, internlänk till /folkets-kaka, kontorsfika på /fika-till-jobbet, FAQPage på /om och /folkets-kaka, square/OG för prova-på-paketet. Rapport: `docs/SEO-REVISION-6.md`.
8. SEO-revision sju: MerchantReturnPolicy (ingen ångerrätt), ursprung Litauen i Product-schema, fraktmål som postnummerprefix ur admin, kakor till kontoret på /fika-till-jobbet och /kakor, Plex Mono-webbtypsnitt bort. Rapport: `docs/SEO-REVISION-7.md`.
9. SEO-revision åtta: admin-yta Sök (GREEN/WARNING/CRITICAL/UNKNOWN), FAQ-nav `/vanliga-fragor`, Service-schema för företagsfika, Bing-verifiering, alias-301, crawlerpolicy, organisk källklass på konverteringar. Rapport: `docs/SEO-REVISION-8.md`.
10. Lager- och leveransmodul: fysiskt/reserverat/disponibelt per sort, produktionsbehov, leveransvecka per ISO-vecka, onsdagslåsning (konfigurerbar) med immutable snapshot, plocklista, leveranssedlar, driftmejl, historik. Lagerprincip: fysiskt saldo minskas vid plock. Cron `/api/cron/lock-delivery-weeks` varje timme; materialiserar prenumerationer före låsning.
11. SERP- och konkurrentintelligens (9 sep): live-sök mot företagsfika, kakor till kontoret, fikaprenumeration och produktköp. Tom kommersiell SERP för företagsfika+kommun; “kakor till kontoret” ägs av grossister (Gille/Nyåkers); prenumerationsqueryn i praktiken tom. Implementation: titlar mot de queriesna, köp-FAQ på PDP, 301-alias, ingen ny doorway. Rapport: `docs/SEO-SERP-INTELLIGENCE.md`.

## 7. Öppna ägarbeslut (blockerar, kan inte lösas i kod)

- Koppla domänen (sist), sätt `SITE_URL`; verifiera Search Console (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) och Bing (`NEXT_PUBLIC_BING_SITE_VERIFICATION`), skicka in sitemap. Admin → Sök visar vad som fortfarande är UNKNOWN.
- Bankgiro, momsnummer, telefon, fakturamejl – verifierade värden i env.
- Google Business Profile (leveransverksamhet utan besöksadress, kategori Bagerigrossist, fyra kommuner); profil-URL i `NEXT_PUBLIC_SAME_AS`. Bekräfta Antennvägen 2 som enda publika adress (NAP).
- Årtalet 1957 i hero-texten och sigillet.
- Automatiskt stopp vid förfallen faktura eller bara flagga (i dag: flagga).
- Vad händer om ingen kan ta emot leveransen (FAQ saknas tills regeln finns).
- Foton: miljöbilder enligt shot list. Kandidatfoton till omröstningen är på plats (hallongrotta, dröm, schackruta).
- Antal kakor per kilo per sort (admin-fält, styr mängdhjälpen; bara ifyllt lokalt i testdata).
- Stavningen "Engelholmsglass" på /om.
- Recept publiceras inte (rekommendation); engelsk sida (egen omgång); Peppol/PDF-faktura erbjuds inte (står i villkor).

## 8. Backlog i kod

- P1: ISR (`revalidate` 300 s) på katalogsidor när produktionsbygget når databasen – layouten är `force-dynamic` (demo-SQLite finns inte under `next build`). Leveransdagar i footern är redan cachade 300 s i runtime.
- P2: FAQ om ej mottagen leverans på /leverans när regeln är beslutad.
- P2: uppdatera /julfika i oktober med årets beställningsstopp (data ur admin).
- P3: engelsk landningssida med hreflang.
- Semrush API-enheter är slut; positionsspårning när domänen är live.

## 9. Rapportartefakter (privata, delas från sidans meny)

- Kundgranskning (alla omgångar, verifiering): https://claude.ai/code/artifact/98f9b16d-2f5c-4426-85ae-eb055cbfbf50
- SEO-revision fem: https://claude.ai/code/artifact/c1c97d75-03f5-40e0-b413-6bf97e819e80
- SEO-revision sex: `docs/SEO-REVISION-6.md`
- SEO-revision sju: `docs/SEO-REVISION-7.md`
- SEO-revision åtta: `docs/SEO-REVISION-8.md`
- SERP- och konkurrentintelligens: `docs/SEO-SERP-INTELLIGENCE.md`
