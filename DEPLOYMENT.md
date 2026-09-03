# DEPLOYMENT — Sockerbagaren.se

Target-arkitektur (låst):

```
GitHub (source of truth)
   ↓  push
Vercel (Next.js, serverless, Git-integration)
   ↓  pooled connection
Neon PostgreSQL (managed databas)
   ↓
sockerbagaren.se (produktionsdomän)
```

Detta dokument är driftmanualen för utvecklare och deploy-agent (Grokbot).
Allt som krävs för drift finns i: repository + environment variables +
Neon + Vercel. Inga hemliga manuella steg.

## Development

```bash
npm install
cp .env.example .env        # lokala defaultvärden pekar på dev-databasen
npm run dev:db              # startar lokal PostgreSQL + migrerar + seedar
                            # (egen terminal; data i /tmp/sockerbagaren-dev-pg)
npm run dev                 # http://localhost:3000
```

Alternativ: peka `DATABASE_URL`/`DIRECT_DATABASE_URL` i `.env` mot en egen
Neon-utvecklingsdatabas och kör `npm run db:migrate && npm run db:seed`.

## Databas (Neon)

- **En central databas-layer**: all åtkomst går via `src/lib/db.ts`
  (Prisma). Inga andra Postgres-klienter får introduceras.
- **Två anslutningssträngar per miljö** (från Neons dashboard):
  - `DATABASE_URL` = **poolad** (värdnamn innehåller `-pooler`) +
    `?sslmode=require&pgbouncer=true&connect_timeout=15` — runtime.
    `pgbouncer=true` krävs: Prisma stänger av prepared statements som inte
    fungerar genom PgBouncers transaction mode. Poolern skyddar mot
    connection exhaustion från parallella serverless-funktioner.
  - `DIRECT_DATABASE_URL` = **direkt** (opoolad) + `?sslmode=require` —
    används ENDAST av `prisma migrate` (schema-DDL ska inte gå via pooler).
- **Region**: skapa Neon-projektet i **AWS eu-central-1 (Frankfurt)** eller
  närmaste EU-region; Vercel-funktionerna är pinnade till `fra1` i
  `vercel.json`. (Marknaden är Sverige — Frankfurt är närmaste stabila
  parning mellan Vercel och Neon.)
- **Miljöseparation** (obligatorisk): production och preview/development
  får ALDRIG dela databas.
  - Production-env i Vercel → production-Neon-databasen.
  - Preview-env i Vercel → en separat Neon-databas **eller** en Neon-branch
    av production. Enklast: skapa en långlivad Neon-branch `preview` och
    sätt dess strängar i Vercels Preview-environment.

## Migrations

- Schemat versioneras i `prisma/migrations/` — en tom Neon-databas
  återskapas fullständigt med `npx prisma migrate deploy`.
- **Runtime kör aldrig migrations.** Migrations körs i deploy-steget eller
  manuellt:
  - Enklast (rekommenderat tills vidare): kör manuellt inför/efter deploy
    av schemaändringar: `DIRECT_DATABASE_URL=... npx prisma migrate deploy`
    (idempotent — redan applicerade migrationer hoppas över; Prismas
    migrationslås förhindrar race vid parallella körningar).
  - Alternativ: lägg `prisma migrate deploy && npm run build` som Build
    Command i Vercel. Gör det medvetet i så fall — varje deploy (även
    preview) kör då migrations mot sin miljös databas.
- Ny migration skapas lokalt mot dev-databasen:
  `npx prisma migrate dev --name <beskrivning>` (kräver interaktiv TTY),
  eller via `prisma migrate diff` + `migrate deploy` (se git-historiken för
  mönstret).

### Migrationssäkerhet (när riktiga kunder finns)

- Inga `DROP TABLE`/`DROP COLUMN`/massdestruktiva ändringar utan
  konsekvensanalys. Använd expand → migrate → contract.
- Inför riskabla schemaändringar: skapa en Neon-branch av production som
  återställningspunkt (Neons point-in-time restore finns också).
- Production-databasen är den som `DATABASE_URL` i Vercels
  Production-environment pekar på — inget annat.

## Seed & admin-bootstrap

- `npm run db:seed` — idempotent: skapar produkterna (Mandelkubb,
  Kolasnittar, Chokladsnittar) och leveransområdena ENDAST om de saknas;
  rör aldrig befintlig data. Säker att köra mot production som bootstrap.
- Första admin: seed skapar en admin från `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  **endast om ingen admin finns**. Senare: `npm run admin:create`
  (uppdaterar/lägger till). Ingen publik registrering finns.
  Kör mot production genom att sätta `DATABASE_URL` till production-
  strängen i det lokala kommandots miljö — aldrig hårdkoda.

## Tester & kvalitet

```bash
npm run check   # typecheck + lint + tester (startar inbäddad PostgreSQL)
npm run build   # deterministisk produktionsbuild (kräver ingen databas)
```

GitHub Actions kör samma kedja på varje push/PR (`.github/workflows/ci.yml`).
Deployment dupliceras inte i CI — det sköter Vercels Git-integration.

## Vercel-projektet

- Kopplat till GitHub-repot; framework-preset Next.js, default build/install
  (`npm run build` via package.json). `vercel.json` innehåller endast det
  nödvändiga: funktionsregion (`fra1`) och cron-schemat.
- **Branchstrategi**: produktionsbranchen deployar production; alla andra
  branches/PRs får Preview Deployments (QA av UI/checkout/admin/mobil).
- Preview är automatiskt skyddad i koden: `noindex`, e-postutskick spärrade
  (log-läge), och ska ha egna preview-databassträngar i Vercels
  Preview-environment.

### Environment variables i Vercel

| Variabel | Production | Preview | Hemlig |
|---|---|---|---|
| `DATABASE_URL` | prod-Neon poolad | preview-Neon poolad | JA |
| `DIRECT_DATABASE_URL` | prod-Neon direkt | preview-Neon direkt | JA |
| `SITE_URL` | `https://sockerbagaren.se` | (utelämna) | nej |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | endast för bootstrap-körning, behövs ej i Vercel | — | JA |
| `EMAIL_PROVIDER` | `resend` | `log` (eller utelämna) | nej |
| `RESEND_API_KEY` | riktig nyckel | (utelämna) | JA |
| `EMAIL_FROM` | verifierad avsändare | — | nej |
| `CRON_SECRET` | lång slumpsträng | (utelämna) | JA |
| `INVOICE_*` | verifierade uppgifter | valfritt | nej |
| `NEXT_PUBLIC_PREFERRED_SOURCES` | `true` | (utelämna) | nej |
| `NEXT_PUBLIC_GA4_ID` | mät-ID om GA används | (utelämna) | nej |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | GSC:s HTML-taggvärde | (utelämna) | nej |

Miljövalidering körs vid varje serverstart (`src/instrumentation.ts`):
saknad `DATABASE_URL` och overifierade fakturauppgifter syns direkt i
Vercel-loggarna.

## Domän

- Kanonisk host: `https://sockerbagaren.se`. `www.sockerbagaren.se`
  301-redirectas till apex (konfigurerat i `next.config.ts`).
- I Vercel: lägg till båda domänerna på projektet och peka DNS enligt
  Vercels anvisningar. TLS sköts av Vercel.

## Cron (prenumerationer)

- `vercel.json` schemalägger `GET /api/cron/generate-subscription-orders`
  dagligen 05:00 UTC. Vercel skickar automatiskt
  `Authorization: Bearer <CRON_SECRET>` när variabeln finns i projektet.
- Endpointen svarar 401 vid fel auth, 503 om `CRON_SECRET` saknas.
- **Idempotent på databasnivå**: unikhetsvillkoret
  `(subscriptionId, subscriptionPeriod)` gör dubbla/överlappande körningar
  och retries ofarliga — samma period kan aldrig ge två ordrar.
- Manuell körning: knappen i admin → Prenumerationer, eller
  `npm run subscriptions:generate`, eller autentiserad POST mot endpointen.

## Smoke test

Efter varje viktig deploy (eller efter Neon-kopplingen):

```bash
npm run smoke -- https://sockerbagaren.vercel.app          # GET-kontroller
SMOKE_PRODUCT_ID=<id från admin> npm run smoke -- <url> --order   # + riktig testorder + PDF
```

Rapporterar PASS/FAIL med exitkod (CI-vänlig). Testordern märks
"SMOKE TEST — RADERA" och avbryts i admin efteråt.

## Observability

- Strukturerade loggar till Vercel Logs: ordermotorfel (med referens-ID som
  även visas för kunden), e-postutfall (`EmailLog`-tabellen + logg),
  cron-resultat, misslyckade admin-inloggningar, miljövarningar vid boot.
- `GET /api/health` → `{ok, database}` (200/503) för smoke tests —
  exponerar inga hemligheter.
- **Sentry** (server-side, endast fel): projektet `landvex-ab/sockerbagaren`
  (EU). Init i `src/instrumentation.ts`; DSN (publik identifierare) i
  `src/lib/sentry-config.ts`, överstyrbar/avstängbar via `SENTRY_DSN`.
  Aktiv endast i deployade miljöer — aldrig lokalt eller i tester.
  Klient-SDK:n är medvetet bortvald (≈80 kB First Load JS); serverfelen
  är de affärskritiska.

## E-post: kvarstående Resend-steg

Resend-kontot har nått sin domängräns — `sockerbagaren.se` kunde inte
läggas upp automatiskt. Inför domänsteget, välj ett av:

1. Uppgradera Resend-planen och lägg upp `sockerbagaren.se`
   (region **eu-west-1**), eller
2. frigör en plats — t.ex. `landvex.se` som ligger overifierad (failad
   DNS) om den inte ska användas — och lägg sedan upp `sockerbagaren.se`.

Därefter: sätt SPF/DKIM-posterna Resend visar i DNS, verifiera, och sätt
`EMAIL_FROM` till en adress på domänen + `EMAIL_PROVIDER=resend` i
Vercels Production-environment. (Ingen befintlig domän raderas
automatiskt — det beslutet är verksamhetens.)

## Rollback

- Dålig deploy: Vercel → Deployments → tidigare READY-deploy → "Promote to
  Production" (omedelbar). Koden är stateless — ingen data påverkas.
- Dålig migration: återställ från Neon-branchen/point-in-time som skapades
  före ändringen; rulla sedan tillbaka koden. Skriv en ny framåtriktad
  migration hellre än att redigera historiska.

## Production smoke test (efter deploy)

1. `GET /api/health` → `{"ok":true,"database":"ok"}`
2. Startsida, områdessida, /bestall renderar
3. Lägg testorder i checkout → ordernummer + nedladdningsbar PDF
4. Ordern syns i admin (logga in) → markera betald → markera levererad
5. Reskontran och leveransvyn uppdaterade
6. `EmailLog`/orderhistorik visar utskicksförsök
7. Cron: autentiserad GET → `{"ok":true,...}`

## Kända medvetna begränsningar

- Rate limiting är in-memory per serverless-instans (skyddar mot enkel
  brute force/spam; distribuerad rate limiting kräver extern lagring och
  är medvetet bortvald i denna skala).
- E-postutskick sker efter commit utan kö — vid providerfel finns ordern
  kvar och admin kan skicka om ("Skicka faktura igen").


## Launch-checklista (i ordning)

1. **Neon**: projekt i EU-region, `DATABASE_URL` (poolad) och `DIRECT_DATABASE_URL`
   (direkt) i Vercel → Production. Skapa en återställningspunkt före första migrationen.
1b. **Resend-domän**: Resend-kontot har nått sin domängräns (12 domäner) —
   ta bort en oanvänd (t.ex. en med status "failed") eller uppgradera planen
   innan `sockerbagaren.se` kan läggas till och verifieras.
2. **Migrationer**: körs automatiskt av `scripts/vercel-build.mjs` i Production
   när `DIRECT_DATABASE_URL` finns i build-miljön. Finns `DATABASE_URL` men inte
   `DIRECT_DATABASE_URL` avbryts bygget (databasen skulle annars hamna i otakt
   med koden). Saknas databas helt byggs sajten med en varning — det är läget
   tills Neon är kopplat. Preview migrerar aldrig.
3. **Seed + admin**: `DATABASE_URL=<prod> I_KNOW_THIS_IS_PROD=1 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run admin:create`
   (minst 12 tecken, aldrig exempelvärden). Sätt etiketten "Bästsäljare" och
   kontrollera priser i admin → Produkter. Momssatsen seedas till 6 %
   (tillfällig livsmedelsmoms t.o.m. 2027-12-31) — admin-översikten påminner
   när den ska tillbaka till 12 %.
4. **Fakturauppgifter**: `INVOICE_BANKGIRO`, `INVOICE_VAT_NUMBER`, `INVOICE_EMAIL`,
   `INVOICE_F_SKATT` med verifierade värden. Utan verifierat bankgiro/momsnr
   stänger ordermotorn beställningar i produktion (503).
5. **E-post**: Resend-domän verifierad (SPF/DKIM), `EMAIL_PROVIDER=resend`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` (bevakad låda — obligatorisk),
   `ADMIN_NOTIFY_EMAIL` (intern avisering vid ny order).
6. **Cron**: `CRON_SECRET` satt; verifiera första körningen i Vercel → Cron Jobs.
7. **Sajt**: `SITE_URL=https://sockerbagaren.se`, `NEXT_PUBLIC_GA4_ID` (samtyckes-
   bannern är inbyggd — scriptet laddas först efter "Tillåt"),
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
7b. **Robotskydd**: skapa en Turnstile-widget i Cloudflare (Managed, gratis),
   sätt `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. Utan nycklar
   är skyddet av (rate limiting + missbruksspärrar gäller ändå).
7c. **Produktionsbranch**: grenen `main` finns i GitHub. Sätt den som
   standardgren i GitHub (Settings → General → Default branch) och som
   Production Branch i Vercel (Settings → Git). Då blir featuregrenar
   preview-deployer och bara `main` går till produktion.
8. **Smoke**: `SMOKE_EMAIL=<egen låda> npm run smoke -- https://<deploy> --order`,
   avbryt testordern i admin (kreditfaktura utfärdas).
9. **Domän SIST**: apex + www i Vercel (www → apex-redirect finns i next.config).
