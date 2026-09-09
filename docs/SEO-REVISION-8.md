# SOCKERBAGAREN SEARCH READINESS REPORT
# SEO-revision 8 – 9 september 2026

Bygger på revision sju (`docs/SEO-REVISION-7.md`). Detta är implementation, inte en pappersaudit. Inga doorway-sidor, inga fejkade recensioner, inga påhittade affärsfakta.

**Score: 90 / 100** (rev 7: 86). De fyra poängen som saknas är desamma som inte kan kodas: produktionsdomän, GSC-egenskap, GBP, TTFB p.g.a. `force-dynamic`.

---

## A. Changes implemented

- Admin **Sök och synlighet** (`/admin/sok`): indexability, sitemap, robots, GSC, Bing, schema, metadata, brutna länkar, GBP, mätning. Status **GREEN / WARNING / CRITICAL / UNKNOWN**. UNKNOWN när data saknas.
- `/vanliga-fragor`: svarsnav för företagsfika, leverans, faktura, prenumeration, allergener. Inte en doorway.
- 301-alias till kanoniska sidor: `/foretagsfika`, `/kontorsfika` → `/fika-till-jobbet`; `/produkter` → `/kakor`; `/om-oss` → `/om`; `/faq` → `/vanliga-fragor`; `/leveransomrade` → `/leverans`.
- JSON-LD `Service` (företagsfika) i sajtgrafen. `Organization.makesOffer` pekar dit. `/om` är `AboutPage`. Inte LocalBusiness (ingen butik).
- `robots.txt`: explicita regler för sökbotar och AI-hämtning. Träning tillåten via `*` tills ägaren beslutar annat. Policy syns i admin.
- Bing-verifiering: `NEXT_PUBLIC_BING_SITE_VERIFICATION` (`msvalidate.01`).
- `X-Robots-Tag: noindex` på `/api`, `/faktura`, `/prenumeration/hantera` (admin hade det redan).
- Organisk mätning: första landning i sessionen klassas `branded | local | product | subscription | info | transactional` och källa `google | bing | …` på GA4-event, utan URL eller PII.
- Internlänkar till FAQ från footer, startsida, `/kakor`, `/fika-till-jobbet`, `/leverans`, `/prenumeration`.
- Prenumerations-FAQ: paus, leveransdag, framförhållning.
- Startsida: “Vad är Sockerbagaren?”
- `/llms.txt` pekar på FAQ-navet.
- Sitemap: `/vanliga-fragor` + `lastModified` för startsidan.

## B. Critical problems fixed

Inga P0 i koden. P1 som gick att stänga:

| Prio | Problem | Åtgärd |
|---|---|---|
| P1 | Ingen operator-yta för sökstatus; risk att GSC “saknas” feltolkas | Admin Sök, med UNKNOWN |
| P1 | Privata PDF-/API-vägar saknade X-Robots-Tag | Headers i next.config |
| P1 | Företagsfika saknade maskinell tjänstentitet | Service-schema |
| P1 | AI-crawlerpolicy odokumenterad | Explicit robots + tabell i admin |
| P1 | Vanliga kundfrågor utspridda, ingen svarssida | `/vanliga-fragor` |

## C. Remaining problems

| Severity | Page | Problem | Why it matters | Recommended fix |
|---|---|---|---|---|
| P0 | hela sajten | `sockerbagaren.se` inte kopplad | Canonical/sitemap pekar på demo-URL; GSC kan inte verifieras mot rätt host | Koppla domänen sist, `SITE_URL=https://sockerbagaren.se` |
| P0 | GSC | Egenskapen är inte verifierad; sitemap inte inskickad | Inga impressions, klick, indexstatus | Se manuella steg (avsnitt M) |
| P0 | Local Pack | Ingen Google Business Profile | Local Pack för “företagsfika Tyresö” vinns inte av sajten ensam | GBP: Bagerigrossist, serviceområden, ingen besöksadress |
| P1 | katalogsidor | `force-dynamic` → sämre TTFB | Ranking och Core Web Vitals | ISR 300 s när produktionsbygget når databasen |
| P2 | `/leverans` | FAQ om ej mottagen leverans saknas | Vanlig kundfråga | Skriv när ägarregeln finns |
| P2 | `/julfika` | 2026-stoppdatum | Säsongssida blir inaktuell | Uppdatera i oktober ur admin |
| P3 | – | Ingen engelsk sida | Irrelevant tills utländska företagskunder i området | Egen omgång + hreflang |
| P3 | Product.offers | `InStock` speglar inte lagret | Merchant listing kan ljuga vid slut | Koppla bara om lagermodellen är pålitlig mot Google |

## D. GSC status

Vad “GSC saknas” betyder, verifierat mot koden (inte gissat):

| Tolkning | Status |
|---|---|
| A. Verifieringskod saknas i koden | **Nej.** Meta-tagg renderas när `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` är satt. |
| B. Sajten är inte verifierad i GSC | **Ja – ägarsteg.** Syns inte från repot. Admin visar UNKNOWN. |
| C. Sitemap är inte inskickad | **Ja – ägarsteg.** Sitemap finns på `/sitemap.xml`. |
| D. API/integration saknas | **Ja.** Ingen Search Console API-nyckel. Inga impressions i admin. |
| E. Integration finns men saknar credentials | **Nej.** Det finns ingen API-integration att fylla i. |
| F. Data finns men används inte | **Nej.** Det finns ingen GSC-data. |
| G. Går inte att verifiera från repot | **Ja, för B och C.** UNKNOWN är det korrekta svaret. |

Preview-deployer är `noindex` (`VERCEL_ENV !== production`).

## E. Sitemap status

- Dynamisk, `force-dynamic`.
- Publika kanoniska URL:er + aktiva produkter.
- `lastModified` bara från `CONTENT_DATES` eller produktens `updatedAt`.
- Ny URL: `/vanliga-fragor`.
- Inte inskickad till GSC/Bing förrän domänen är live.

## F. Robots status

- `Allow: /` för `*`, Googlebot, Bingbot, DuckDuckBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-Search, Claude-User, Google-CloudVertexBot.
- `Disallow`: `/admin`, `/api`, `/faktura`, `/prenumeration/hantera`.
- `Sitemap:` absolut URL.
- `Host:` bara när SITE_URL är sockerbagaren.se.
- **Träning** (GPTBot, Google-Extended, CCBot, ClaudeBot, Applebot-Extended): tillåten via `*`. Sök och träning är medvetet åtskilda. Ägaren kan stänga träning senare utan att röra sökindexering.

## G. Structured-data status

| Typ | Var | Kommentar |
|---|---|---|
| Organization | layout | Inte Bakery/LocalBusiness. `makesOffer` → Service. |
| WebSite | layout | Ingen SearchAction (ingen sajtsök). |
| Service | layout | Företagsfika, fyra kommuner, BusinessAudience. |
| MerchantReturnPolicy | layout + Offer | Ingen ångerrätt, länk `/villkor`. |
| Product + Offer | PDP, listor | B2B-pris exkl. moms, ursprung Litauen, postnummerprefix. |
| FAQPage | sidor med synlig FAQ + `/vanliga-fragor` | Samma text som `<details>`. |
| AboutPage | `/om` | |
| Article | `/fika-till-jobbet`, `/julfika` | |
| Review / Rating / LocalBusiness | – | Avsiktligt utelämnat. |

## H. SERP opportunities

Observerat 2026-09 (inte fabricerat):

| Query | Intent | Dominant result type | SERP features | Our page | Gap | Action |
|---|---|---|---|---|---|---|
| kakor till kontoret | transactional B2B | Kontorsgrossister (Kontorab, Gille i storpack) | produktlistor, inte Local Pack | `/kakor`, `/fika-till-jobbet` | kvalitet vs fabrikskaka | Ingen ny URL. Befintlig FAQ “varför inte grossisten” + kilo-copy. |
| fika till jobbet / kontorsfika | commercial | Godsmak, Torebrings, Caterbee | FAQ, service landningssidor | `/fika-till-jobbet` | Service-schema saknades | Stängt: Service + FAQ-nav. |
| företagsfika Tyresö m.fl. | local | Local Pack + generiska fikasidor | Maps, Local Pack | `/tyreso` … | GBP saknas | Ägare: GBP. Sajten förklarar redan område, dag, faktura. |
| kolasnittar / kolakakor | info/recept (köp i title) | receptbloggar | PAA, recept, bilder | `/kakor/kolasnittar` | recept-intent jagas inte | Oförändrat ägarbeslut. |
| fikaprenumeration företag | subscription | få träffar, lokala bagerier | FAQ | `/prenumeration` | paus/leveransdag | Stängt i FAQ. |
| vad kostar / hur beställer man | AEO | People Also Ask | PAA, AI-översikter | `/vanliga-fragor` | nav saknades | Ny sida. |

Vi optimerar mot den faktiska SERP:n: B2B-kaka är en nisch mot Gille/Kontorab, inte en receptblogg och inte en cateringmarknadsplats.

## I. Local SEO opportunities

- Fyra kommuncidor finns och är inte kopior av varandra.
- NAP: Antennvägen 2, Tyresö är enda publika adressen. Radiovägen är lager, inte besök.
- Local Pack kräver GBP (ägare). Schema förblir Organization + Service, inte påhittad LocalBusiness med geo.
- Alias `/foretagsfika` 301:ar till guiden – inget extra thin content per ort.

## J. AI-search readiness

Varje viktig sida kan svara på:

| Fråga | Var |
|---|---|
| What is this? | Start, `/om`, FAQ “Vad är Sockerbagaren?” |
| Who is it for? | Start, FAQ, Service.audience |
| Where? | Banner, `/leverans`, områdessidor, FAQ |
| What does it cost? | PDP, kassa, FAQ (pris på sidan, inte fabricerat schablon) |
| How does delivery work? | `/leverans` |
| What products? | `/kakor` |
| Can I subscribe? | `/prenumeration` |
| How do I order? | `/bestall`, FAQ |
| Conditions? | `/villkor`, returpolicy i schema |

`/llms.txt` är den maskinläsbara sammanfattningen. Retrieval-botar är tillåtna. Ingen “ChatGPT-hack”.

## K. Performance impact

- Ingen ny klientbunt på publika sidor utöver en `useEffect` som skriver två sessionStorage-nycklar.
- Service-noden är några hundra tecken JSON-LD, SSR.
- Inga nya bilder, inga nya typsnitt.
- TTFB oförändrad (`force-dynamic`). ISR kvarstår som P1 när produktion har DB.

## L. Pages created/changed

**Ny:** `/vanliga-fragor`, `/admin/sok`.

**Ändrad:** startsida, `/kakor`, `/fika-till-jobbet`, `/prenumeration`, `/leverans`, `/om`, footer, robots, sitemap, schema, layout, next.config, llms.txt, analytics.

**301:** `/faq`, `/foretagsfika`, `/kontorsfika`, `/produkter`, `/produkter/:slug`, `/leveransomrade`, `/om-oss`.

Beställningsflödet är orört i UX.

## M. Manual actions still required

1. Koppla **sockerbagaren.se** i Vercel. Sätt `SITE_URL=https://sockerbagaren.se`. Sist.
2. **Google Search Console:** URL-prefix `https://sockerbagaren.se` → verifiering HTML-tagg → värdet i `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → deploy → bekräfta → skicka in `https://sockerbagaren.se/sitemap.xml`.
3. **Bing Webmaster Tools:** samma host, `msvalidate.01` i `NEXT_PUBLIC_BING_SITE_VERIFICATION`, samma sitemap.
4. **Google Business Profile:** leveransverksamhet utan besöksadress, kategori Bagerigrossist, serviceområden Tyresö/Nacka/Haninge/Huddinge. Profil-URL i `NEXT_PUBLIC_SAME_AS`.
5. `NEXT_PUBLIC_GA4_ID` om organiska ordrar ska följas. Event `order_completed` bär `source_class` och `landing_cluster`.
6. Rich Results Test på en produktsida och startsidan efter lansering.

Instruktionerna ligger också i admin under **Sök**.

## N. Recommended next 30 days

1. Domän + GSC + sitemap-inskick + Bing.
2. GBP-utkast; ingen recensionsspam.
3. Bekräfta merchant listing (retur + frakt + ursprung) i Rich Results Test.
4. När GSC har data: CTR på titles för “kakor till kontoret”, kolasnittar, områdessidor. Justera titles bara mot first-party queries.
5. Inte: fler ortssidor, inte receptblogg, inte engelsk maskinöversättning.

KPI när GSC finns (ingen simulerad data nu): impressions, klick, CTR, position, indexerade vs upptäckta, organiska ordrar (`source_class=google|bing` + `landing_cluster`), branded vs non-branded.

---

## Definition of done

- [x] Sitemap korrekt (ny URL + lastmod)
- [x] Robots korrekt (sök vs träning dokumenterat)
- [x] Canonicals orörda på kanoniska sidor; alias 301
- [x] Unik metadata på nya sidan
- [x] Produktstruktur begriplig
- [x] Lokal geografi begriplig
- [x] Företagsfika som entity (Service)
- [x] Prenumeration sökbar, FAQ utökad
- [x] Structured data semantiskt korrekt
- [x] Internlänkning till FAQ
- [x] Inga orphan pages införda
- [x] Admin/private skyddade
- [x] GSC-status exakt dokumenterad (UNKNOWN där det saknas data)
- [x] SERP observerad, inte checklistad blint
- [x] AI-search-readiness
- [x] Beställningsflöde orört; SEO-crawl 21 URL:er, 0 fel; schema- och status-tester gröna
