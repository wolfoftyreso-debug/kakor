# Sockerbagaren – SERP, lokal sök & konkurrentintelligens

**Datum:** 9 september 2026
**Typ:** evidensbaserad sökmarknadsanalys + implementation. Inte en teknisk SEO-audit.
**Metod:** live webbsök mot seed-queries och expansioner, sidläsning av rankande konkurrenter, kartläggning av egen sajt. Google Search Console: saknas. Semrush live-API: slut (UNKNOWN). SERP-features (Local Pack, AI Overview, PAA, featured snippet) kan inte bekräftas pixel-för-pixel från sökverktyget – markeras UNKNOWN där de inte syntes i träfflistan.

**Volymer, rankingar och CTR: UNKNOWN** om de inte står som tidigare observerade i repo (rev 5–8). De återges inte som fakta här.

---

## 1. Affären (sökrelevant)

| Fakta | Värde |
|---|---|
| Vad | Gammaldags svenska småkakor på **riktigt smör**, per kilo |
| Sorter | Kolasnittar, mandelkubb, chokladsnittar + prova-på-paket 1,5 kg |
| Vem | Företag (kontor, verkstad, butik, klinik). Inte privatpersoner. |
| Var | Tyresö, Nacka, Haninge, Huddinge. Ingen innerstad, ingen butik. |
| Hur | Fasta leveransdagar, bemannad företagsadress, **faktura** |
| Återkommande | Fikaprenumeration varje / varannan / var fjärde vecka, ingen bindningstid |
| Inte | Recept, hembakat, nybakat, “kontakta oss”, LocalBusiness med besöksadress |

Målet är inte maximal trafik. Målet är **relevant sök → kvalificerat företag → order/prenumeration → återköp**.

Befintliga landningssidor som bär sökintention: `/` `/kakor` `/kakor/[slug]` `/prenumeration` `/fika-till-jobbet` `/tyreso` `/nacka` `/haninge` `/huddinge` `/leverans` `/vanliga-fragor` `/julfika`.

---

## 2. Query-universum (seed + observerad SERP)

Volym = **UNKNOWN**. Klassning bygger på SERP-typ och affärsmatch, inte gissad volym.

### A. Företagsfika

| Query | Intent | Affärsvärde | Lokal | Köp | Konvertering | Tillfälle | Vår sida |
|---|---|---|---|---|---|---|---|
| företagsfika | commercial | 4 | 2 | 3 | 3 | 4 | `/fika-till-jobbet` |
| företagsfika Stockholm | commercial/local | 2 | 2 | 2 | 2 | 2 | Ingen – vi levererar inte innerstan |
| företagsfika Tyresö | local + transactional | 5 | 5 | 5 | 5 | **5** | `/tyreso` |
| företagsfika Nacka | local + transactional | 5 | 5 | 5 | 5 | **5** | `/nacka` |
| företagsfika Haninge | local + transactional | 5 | 5 | 5 | 5 | **5** | `/haninge` |
| företagsfika Huddinge | local + transactional | 5 | 5 | 5 | 5 | **5** | `/huddinge` |
| fika till företag | commercial | 4 | 3 | 4 | 4 | 4 | `/fika-till-jobbet` |
| fika till kontoret | transactional | 5 | 3 | 5 | 4 | 4 | `/fika-till-jobbet` `/kakor` |
| kontorsfika | commercial | 4 | 3 | 4 | 4 | 4 | `/fika-till-jobbet` |
| beställa fika företag | transactional | 5 | 3 | 5 | 5 | 4 | `/bestall` via guiden |
| fika med leverans | commercial | 3 | 3 | 4 | 3 | 3 | `/leverans` |

**Observerat:** “företagsfika Tyresö” gav **inga** kommersiella fikaleverantörer i träfflistan – kommunsidor, näringslivsdag, företagsregister. Tom kommersiell SERP. Samma mönster Nacka (ICA Maxi-catering till *event*, inte veckokakor). Stockholm-queryn ägs av **Godsmak** och **Caterbee** (marknadsplatser mot innerstan/norrort).

### B. Kakor till företag

| Query | Intent | Affärsvärde | Tillfälle | Vår sida |
|---|---|---|---|---|
| kakor till kontoret | transactional B2B | 5 | **5** | `/kakor` (titel bytt mot queryn) |
| kakor till företag | transactional | 5 | 5 | `/kakor` |
| beställa kakor företag | transactional | 5 | 4 | `/bestall` `/kakor` |
| småkakor företag | product + B2B | 4 | 4 | `/kakor` |
| kakor med leverans Stockholm | commercial | 2 | 2 | Ej primär – vi är södra kommuner |

**Observerat:** “kakor till kontoret” ägs av **kontorsgrossister**: Kontorab, SwedOffice, Kontorsgiganten, Lomax, Office Depot. Produkten är Gille / Nyåkers / Royal Dansk i 700–900 g-burk. Sockerbagarens demo-URL syntes i samma kluster – nischen “riktiga smörkakor per kilo” är i praktiken obesatt.

### C. Prenumeration

| Query | Intent | Tillfälle | Vår sida |
|---|---|---|---|
| fikaprenumeration | subscription | **5** | `/prenumeration` |
| fikaprenumeration företag | subscription | 5 | `/prenumeration` |
| fika prenumeration | subscription | 4 | `/prenumeration` |
| kakor abonnemang | subscription | 4 | `/prenumeration` |
| kontorsfika abonnemang | subscription | 3 | `/prenumeration` |
| veckoleverans fika | subscription | 5 | `/prenumeration` |
| återkommande fika företag | subscription | 4 | `/prenumeration` |

**Observerat:** “fikaprenumeration företag” och “kontorsfika abonnemang” gav **irrelevans** (tidningsprenumerationer, kontorsmöbler). Kommersiell SERP i princip tom. Högsta tillfället i universumet efter de fyra kommungueryerna.

### D. Produkter

| Query | Intent | Tillfälle | Kommentar |
|---|---|---|---|
| kolasnittar | informational/recept | 1 | Receptbloggar (Arla, koktips). **Jagas inte.** |
| köpa kolasnittar | product + transactional | 4 | Dagligvaruhandel (Dazzley/Hemköp, margarin) |
| beställa kolasnittar | transactional | 5 | Nästan tom B2B-yta |
| mandelkubb | mixed | 2 | Recept + Nyåkers i Coop (vegetabilisk olja) |
| köpa mandelkubb | product | 4 | Grocery |
| chokladsnittar | mixed | 2 | Dazzley + recept |
| köpa chokladsnittar | product | 4 | Grocery, margarin |
| svenska småkakor | informational | 2 | Wikipedia, kategori |

Ägarbeslut oförändrat: inga receptsidor. Kommersiella “köpa/beställa X till företaget” ägs på PDP.

### E. Local – bara leveransområden

Inga sökord för Solna, Kista, innerstan, Göteborg. Stockholm-termen används bara när den faktiskt beskriver södra kommunerna (“södra Stockholm” i varumärkestitel).

### F. Problem / behov

| Query | Intent | Tillfälle |
|---|---|---|
| fika till personalen | commercial | 5 |
| fika till arbetsplatsen | commercial | 4 |
| fika till möte | commercial | 3 |
| veckofika företag | subscription | 4 |
| fredagsfika företag | commercial | 4 |
| fika personal Stockholm | local, svag | 2 |

**Observerat:** “fika till personalen” ägs av HR-/skatteinnehåll (Pleo: personalvårdsförmån), inte av kakleverantörer.

---

## 3. Intent-karta – prioritering

Vi prioriterar **inte** högst volym. En lokal “företagsfika Tyresö” med få sökningar slår “kolasnittar”-recept.

**P0 att vinna (tom eller felaktigt ockuperad SERP, hög konvertering):**

1. företagsfika {Tyresö,Nacka,Haninge,Huddinge}
2. kakor till kontoret / kakor till företag
3. fikaprenumeration / veckoleverans fika
4. köpa/beställa kolasnittar|mandelkubb|chokladsnittar till företaget
5. fika till personalen / fredagsfika

**P1 att synas i, inte att “vinna” med ny URL:**

- fika till jobbet / kontorsfika (Godsmak, Caterbee, Torebrings – annan produkt)
- kakor till kontoret vs Gille (samma query, annan produkt – differentiera)

**P2 att ignorera:**

- Recept-intent (kolasnittar, chokladsnittar som bakning)
- Innerstads-catering
- Kaffeautomater, minibutik, eventlokaler

---

## 4. Live SERP-observationer

Sökdatum: 2026-09-09. Kontext: webbsök, inte inloggad Google med geo-Tyresö. Local Pack / Maps / AI Overview / PAA / video: **UNKNOWN** om inte annat anges.

| Query | Topp organiska (observerade) | Local pack | Vår närvaro | Gap |
|---|---|---|---|---|
| företagsfika Tyresö | tyreso.se, företagsregister, näringslivsdag | UNKNOWN (inga kartträffar i listan) | ingen produktionsdomän | Tom kommersiell SERP |
| företagsfika Stockholm | Caterbee, Godsmak, Wikipedia/caféer | UNKNOWN | nej – och ska inte | Fel geo |
| kakor till kontoret | Kontorab, SwedOffice, Kontorsgiganten, Office Depot, Torebrings | UNKNOWN | demo-URL syntes | Grossist vs smörkaka |
| fika till jobbet | HR-artiklar, Torebrings, Johnséns, FikaAtWork, Godsmak | UNKNOWN | `/fika-till-jobbet` finns | Annan produkt (bullar/catering) |
| kolasnittar | Arla, koktips, TasteAtlas, receptbloggar | nej | PDP finns | Recept, inte köp |
| köpa mandelkubb | Coop Nyåkers, Willys Dazzley, recept | nej | PDP | Grocery |
| fikaprenumeration företag | irrelevans (lönevisning, tidningar) | nej | `/prenumeration` | Tom |
| företagsfika Nacka | ICA Maxi Nacka catering, kommun | UNKNOWN | `/nacka` | Eventcatering, inte kilo-kaka |
| fika till personalen | Pleo skatteregler, HR | nej | guide (ny H2) | Inget erbjudande i SERP |
| småkakor per kilo | Sockerbagaren-demo, baklavafabriken, Gille via Torebrings | nej | `/kakor` | Nisch nästan egen |

---

## 5. Verkliga konkurrenter (från SERP, inte från magkänsla)

### DIRECT BUSINESS COMPETITOR

Ingen observerad aktör säljer **gammaldags smörkakor per kilo med faktura och prenumeration till just Tyresö/Nacka/Haninge/Huddinge**. Det är den strategiska luckan.

### INDIRECT – samma köpögonblick, annan produkt

| Aktör | Typ | Geo | Erbjudande | Pris synligt | Prenumeration | Svaghet mot oss |
|---|---|---|---|---|---|---|
| **Kontorab** | kontorsgrossist | nationell | Gille/Nyåkers/Delicato i burk | ja (~90–112 kr/800 g) | nej | margarin/fabrik, ingen lokal dag |
| **Kontorsgiganten / SwedOffice / Lomax / Office Depot** | samma | nationell | samma burkar | ja | nej | samma |
| **Godsmak** | marketplace lunch/fika | Sthlm, Solna, Sundbyberg, Kista, Uppsala | många bagerier, samma dag | nej | nej | inte våra kommuner; ingen kilo-kaka; ingen prenumeration |
| **Caterbee** | marketplace catering | “hela Stockholm”, 2 h | 20+ kök, offert | nej | nej | eventfika, inte veckokaka |
| **Torebrings** | fryst grossist | nationell | Gille + fryst fikabröd | ja | nej | fabrik/fryst uppgräddning, inte smörsnittar per kilo |
| **ICA Maxi Nacka Catering** | stormarknadscatering | Nacka | pajer, bakelser, event | delvis | nej | tillställning, inte personalrum |

### SERP COMPETITOR (syns, säljer inte samma sak)

Arla, koktips.se, Gustavs Kitchen, Wikipedia, TasteAtlas, Testix “kakor bäst i test”, Pleo-bloggen.

### MARKETPLACE / DIRECTORY

Hitta.se, Eniro, Kompass – socker/kex-kategorier. Inte köpintention.

### LOCAL BUSINESS (samma industriområde, annan vara)

**Annas Pepparkakor**, Radiovägen Tyresö – pepparkakstillverkare, B2B nationellt, inte veckofika. Viktig NAP-granne: blanda inte ihop adresser. Vår publika adress är Antennvägen 2; lagret Radiovägen 19.

### LARGE NATIONAL

Gille / Continental Bakeries, Nyåkers, Dazzley (Axfood private label). De vinner “köpa kolasnittar” i matbutik till ~63 kr/kg **på margarin**.

**Verifierade ingredienser (butik, 2026-09-09):**

- Hemköp/Willys **Dazzley Kola Snittar**: *margarin (vegetabiliskt fett palm/raps/kokos)*
- Willys **Dazzley Chokladsnittar**: samma margarinbas
- Coop **Nyåkers Mandelkubb**: *vegetabilisk olja (shea, kokos, raps)* – inte smör

Det är den enda jämförelsen vi gör publikt: **smör, inte margarin**. Inga påhittade priser eller recensioner.

---

## 6. Konkurrentfrekvens (toppträffar i våra kommersiella sök)

Räknat över observerade träfflistor för klustren A–C + “kakor till kontoret” + produkt-köp. Inte vetenskaplig N=100 – en riktad räkning.

| Domän | Topp-träffar observerade | Kluster | Typ | Direct? |
|---|---|---|---|---|
| kontorab.se | hög | kakor till kontoret | grossist | indirect |
| godsmak.se | hög | företagsfika Sthlm, fika till företaget | marketplace | indirect |
| caterbee.com | medel | företagsfika Sthlm | marketplace | indirect |
| torebrings.se | medel | fika till jobbet, Gille | grossist | indirect |
| kontorsgiganten.se / swedoffice.se / lomax.se | medel | kakor till kontoret | grossist | indirect |
| arla.se / koktips.se | hög | kolasnittar (recept) | editorial | nej |
| coop.se / willys.se / hemkop.se | hög | köpa mandelkubb/kolasnittar | grocery | nej |
| tyreso.se / nacka.se | hög | företagsfika + kommunnamn | kommun | nej |
| sockerbagaren (demo) | låg men synlig | kakor, småkakor per kilo | vi | – |

**Dominanta sökkonkurrenter att slå på *rätt* query:** Kontorab (kakor till kontoret) och tomheten på företagsfika+kommun. Inte Arla.

---

## 7. Reverse engineering – vad Google belönar

### Kontorab `/kakor` (vinner “kakor till kontoret”)

- Page type: kategori + produktgrid
- Title: “Kakor till kontoret – Låga priser”
- H1: “Kakor”
- Priser exkl. moms, leverans 1–2 dagar, fri frakt från 995 kr
- Köpguide, allergifilter, varumärken
- Ingen prenumeration, ingen lokal dag, ingen smörsignal
- **Signal:** exact-match title + pris + B2B-logistik

### Godsmak `/fika-till-foretaget`

- Title/H1 exact match
- FAQ, steg-för-steg, “fredagsfika”
- **Ingen** pris, **ingen** prenumeration, geo = norr/innerstan
- ~650 ord, tunn produkt
- **Signal:** query i H1 + FAQ + tydlig CTA, även utan pris

### Caterbee `/fika`

- Marketplace, “begär offert”, 2-timmarsleverans
- **Signal:** snabbhet och sortimentsbredd – inte vårt spel

### ICA Maxi Nacka catering

- Local + “företagsfika” i brödtext
- Eventbakelser
- **Signal:** lokal modifierare i copy räcker för att synas när ingen annan finns

### Vad vi tar med oss

Google belönar för de här intentionerna: **exact query i title/H1**, synligt pris, B2B-signal (faktura, exkl. moms), FAQ som speglar frågan, geo i title för lokala queries. Inte 3 000 ord. Inte recept. Inte LocalBusiness-schema utan butik.

---

## 8. Content gap

| Gap | Användaren vill | Konkurrenten ger | Vi gav (före) | Åtgärd |
|---|---|---|---|---|
| MISSING TITLE MATCH | “kakor till kontoret” | Kontorab exact title | “Gammaldags småkakor…” | Title/H1 bytt |
| MISSING LOCAL TITLE | “företagsfika Tyresö” | ingen kommersiell | “Kakor till företag i Tyresö” i title | Title = “Företagsfika i {kommun}” |
| MISSING BUY-INTENT ON PDP | “köpa kolasnittar” | Dazzley 300 g margarin | kunskaps-H2 “Om kolasnittar” | H2 “Köpa X till företaget” + FAQ |
| MISSING SUBSCRIPTION SERP | “fikaprenumeration” | tomt/irrelevans | sidan fanns, svag “veckoleverans” | H2 + FAQ + alias |
| MISSING PROBLEM QUERY | “fika till personalen” | Pleo skatt | saknades som H2 | H2 på guiden |
| WEAK VS GROSSIST | varför inte Gille | pris/snabbhet | FAQ fanns | utbyggd H2, smör vs margarin (verifierat) |
| MISSING URL ALIAS | människor skriver queryn som path | – | få alias | 301-lista utökad |
| MISSING LOCAL PACK | karta för företagsfika Tyresö | UNKNOWN | ingen GBP | **ägare – kan inte kodas** |
| RECIPE TRAP | kolasnittar recept | Arla m.fl. | medvetet undviket | oförändrat |

**Konkurrenternas svagheter vi utnyttjar, inte kopierar:**

- Ingen tydlig prenumeration hos Godsmak/Caterbee/Kontorab
- Ingen av dem är B2B-smörkaka per kilo i södra kommunerna
- Priser saknas på marketplace-sidorna
- Grocery-kolasnittar är margarin – vi kan säga det för att det står på förpackningen
- Godsmak nämner inte Tyresö/Haninge som kärngeo
- Caterbee är offert + 2 h, inte veckofika i personalrummet

---

## 9. Implementation denna omgång

Inga doorway-sidor. Inga nya URL:er. Inga fejkade recensioner. Inga påhittade volymer.

| Ändring | Varför (SERP) |
|---|---|
| `/kakor` title+H1 “Kakor till kontoret på riktigt smör” | exact match mot dominant B2B-query |
| Områdestitlar “Företagsfika i {kommun}” | tom lokal SERP, ICA-mönstret |
| Unika metabeskrivningar per kommun med ortsnamn | crawl-krav + lokal signal |
| FAQ “Finns det företagsfika med leverans i X?” | PAA/AEO, lokal transactional |
| PDP-H2 “Köpa {sort} till företaget” + köp-FAQ | “köpa kolasnittar” ägs av Dazzley |
| Smör vs margarin, verifierat mot butik | differentiering mot grocery/grossist |
| Prenumeration: veckoleverans-H2, alias `/fikaprenumeration` | tom subscription-SERP |
| Guide-H2 “Fika till personalen” | problem-query |
| 301: kolakakor, mandelkubbar, kakor-till-kontoret, fredagsfika, företagsfika-{kommun} | query-as-path |
| Footer-ankare “Kakor till kontoret” | internlänk mot money query |
| llms.txt: köpa-URL:er | AI-sök |

**Medvetet inte byggt:**

- Sidor för Stockholm innerstan
- Recept
- Extra kommun-URL:er (doorway)
- LocalBusiness-schema
- Prisjämförelsetabell med konkurrentpriser (rörliga, inte våra)

---

## 10. Mätning (när det går)

Utan domän och GSC är allt **UNKNOWN**. När `sockerbagaren.se` är live:

| Query | Baseline nu | Mål 90 dagar | Var |
|---|---|---|---|
| företagsfika Tyresö (osv.) | inte mätbart | top 10 organisk + GBP i pack om ägaren skapar profil | GSC + Maps |
| kakor till kontoret | demo syntes | sidan `/kakor` i top 20, inte nödvändigtvis #1 mot Kontorab | GSC |
| fikaprenumeration | tom SERP | `/prenumeration` synlig | GSC |
| köpa kolasnittar | grocery | PDP i köp-SERP, inte recept | GSC |
| konvertering | acquisition-klass `local` / `product` / `subscription` | order från de klasserna | GA4-event redan i kod |

Admin → Sök visar fortfarande UNKNOWN för GSC/GBP tills ägarstegen är gjorda.

---

## 11. Ägarblockers (påverkar sök mer än copy)

1. Koppla **sockerbagaren.se**, `SITE_URL`, skicka sitemap till GSC och Bing.
2. **Google Business Profile**: kategori Bagerigrossist, serviceområden de fyra kommunerna, ingen besöksadress. Annars vinns inte Local Pack.
3. NAP: Antennvägen 2 är enda publika adressen. Radiovägen är lager.

Utan 1–2 är den här omgången förberedelse, inte ranking.

---

## 12. 30 / 60 / 90

- **30:** Domän + GSC + GBP. Låt de här title-ändringarna indexeras. Inga fler sidor.
- **60:** Läs first-party queries. Döda copy som inte får impressions. ISR när produktion har databas (P1 sedan tidigare).
- **90:** Om “kakor till kontoret” impressions finns men låg CTR: testa title mot Kontorabs “låga priser”-vinkel utan att ljuga om pris. Om lokala queries saknas: GBP först, inte fler landningssidor.
