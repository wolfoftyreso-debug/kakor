# SEO-revision 6 – Sockerbagaren

Skriven 9 september 2026. Bygger på revision fem (crawl, sökordsuniversum, intent-karta, områdessidor, `seo:crawl`). Den här omgången mäter om, implementerar de luckor fem lämnade och dokumenterar det som fortfarande är blockerat.

Search Console finns inte – domänen är inte kopplad. All sökdata är Semrush (se, 2026-09, citerad i sidkommentarer) plus SERP-observation. Inga påhittade affärsfakta, inga doorway-sidor, ingen schema för innehåll som inte syns.

## 1. Executive summary

**Score: 82 / 100** (revision fem lämnade en tekniskt mogen sajt; den här omgången tar bort de sista P1-felen i schema och internlänkning och täcker söktermen *kontorsfika*).

Sajten är crawlbar, har self-canonicals, unik title/description, FAQPage där frågor visas, Product+Offer med B2B-pris, Organisation utan fejkade recensioner, `/llms.txt` och en CI-crawl. Preview är noindex. Det som sänker betyget är: ingen Search Console, ingen GBP, `force-dynamic` överallt (TTFB), Semrush-enheter slut, och några söktermer med volym som avsiktligt *inte* fått egna URL:er.

## 2. Critical issues (P0/P1)

| Prio | Issue | Status |
|---|---|---|
| P1 | `Offer.shippingDestination` sa hela Sverige, vi kör bara fyra kommuner | **Fixat** |
| P1 | Startsida saknade Twitter-kort (ärvde rotens äldre titel) | **Fixat** |
| P1 | `/folkets-kaka` saknades i footern (svag intern auktoritet) | **Fixat** |
| P0 | Search Console / sitemap-inskick | Blockerat: domän sist |
| P0 | Google Business Profile + NAP/sameAs | Blockerat: ägare |

Inga 4xx/5xx, redirect loops, conflicting canonicals eller index-bloat i crawl (20 sitemap-URL:er, alla 200, self-canonical, ≥4 inlänkar).

## 3. Technical SEO

- **Crawl:** 20 indexerbara URL:er. `/admin`, `/api`, `/faktura`, `/prenumeration/hantera` i robots.txt. Preview `noindex`. www→apex 301.
- **Rendering:** hela `(site)` är `force-dynamic` (footer läser leveransdagar). ISR 300 s är P2 tills produktionsbygget når databasen.
- **JS-SEO:** RSC/SSR – SEO-text finns i initial HTML. Kassans H1 är stegtext (`Välj kakor`); det är avsiktligt transaktionellt.
- **Hreflang:** ingen. En språkversion (sv-SE). Engelska är P3, egen omgång.
- **Sitemap:** bara kanoniska, indexerbara URL:er + aktiva produkter. `lastModified` bara där det finns verkligt datum (`CONTENT_DATES` + produkt `updatedAt`).

## 4. Keyword universe (Semrush se, 2026-09)

| Query | Vol/mån | Intent | Primär URL |
|---|---|---|---|
| kolakakor | 33 100 | info/recept (köpsignal i title) | `/kakor/kolasnittar` |
| kolasnittar | 22 200 | info + kommersiell | `/kakor/kolasnittar` |
| kakor | 14 800 | blandad, för bred | `/kakor` (kategori, inte homepage) |
| småkakor | 8 100 | info/kategori | `/kakor` |
| chokladsnittar / snittar | 8 100 | info + produkt | `/kakor/chokladsnittar` |
| chokladkakor | 6 600 | info, synonym | title på chokladsnittar |
| mandelkubb(ar) | 4 400 | info + produkt | `/kakor/mandelkubb` |
| smörkakor | 1 900 | kategori | `/kakor` (H2/body, ingen egen URL) |
| gammaldags småkakor | 1 600 | kategori | `/kakor` H1 |
| fikabröd | 1 600 | kategori | `/kakor` |
| julfika | 1 600 | säsong | `/julfika` |
| påskfika | 720 | säsong | H2 på `/julfika` (ingen doorway) |
| kaffebröd | 590 | kategori | `/kakor` |
| fika till jobbet / fredagsfika | 320 | kommersiell B2B | `/fika-till-jobbet` |
| fika på jobbet | 210 | info/B2B | `/fika-till-jobbet` |
| fika att bjuda på jobbet | 170 | info | `/fika-till-jobbet` |
| fredagsfika på jobbet | 110 | kommersiell | `/fika-till-jobbet` |
| konferensfika | 30 | kommersiell | `/fika-till-jobbet` |
| **kontorsfika** | (saknades i Semrush-urvalet, används i SERP av Godsmak m.fl.) | kommersiell B2B | `/fika-till-jobbet` **nu** |

## 5. Search intent map

- **Transaktionell:** `/bestall`, `/kakor/{slug}`, `/prenumeration`
- **Kommersiell utredning:** `/kakor`, `/fika-till-jobbet`, `/leverans`, områdessidor
- **Lokal:** `/tyreso` `/nacka` `/haninge` `/huddinge`
- **Informational:** `/fika-till-jobbet`, `/julfika`, `/ingredienser`, produkt-FAQ
- **Navigational/varumärke:** `/`, `/om`, `/folkets-kaka`
- **Jämförelse:** FAQ “Varför inte kakor från kontorsgrossisten?” på `/kakor` (ingen `/vs-gille`-doorway)

Två sidor tävlar inte om samma primära intent. `fredagsfika`/`påskfika`/`smörkakor` ligger som H2 på befintliga sidor – medvetet, inte egna URL:er.

## 6. Content gap map

| Gap | Beslut |
|---|---|
| kontorsfika | **Stängd:** synonym + H2 + FAQ på `/fika-till-jobbet` |
| FAQ på `/om` och `/folkets-kaka` | **Stängd** |
| Ej mottagen leverans | Blockerat: ägarregel saknas |
| Julfika 2026-stopp | Oktober, data ur admin |
| Engelska | P3, egen omgång |
| Receptsidor för 33k “kolakakor” | **Nej.** Vi säljer, publicerar inte recept (ägarbeslut). Title/aka fångar synonymen utan att fejka en receptblogg. |

## 7. Page → keyword map

Se tabell i §4. Primär konvertering: beställning mot faktura. Sekundär: prenumeration, röstning, guide → kassa.

## 8. Internal linking

Chrome: header (kakor, prenumeration, leverans, om) + footer HANDLA / LEVERANS / INFORMATION. **`/folkets-kaka` ligger nu i footern.** Startsida, `/om` och PollNudge länkar dit sedan tidigare. Områdessidor korslänkar inte varandra (avsiktligt – olika intent per kommun).

## 9. Structured data map

| Typ | Var | Kommentar |
|---|---|---|
| Organization | layout | Inte Bakery/LocalBusiness. sameAs tomt tills GBP. |
| WebSite | layout | Ingen SearchAction (ingen sajtsök). |
| WebPage / CollectionPage | alla indexerbara | |
| BreadcrumbList | alla utom start | Speglar synlig rad |
| Product + Offer | produkter, listor | B2B-pris exkl. moms. **Fraktmål = fyra kommuner.** |
| FAQPage | /, /kakor, PDP, områden, guide, jul, leverans, **om, folkets-kaka** | Samma text som `<details>` |
| Article | /fika-till-jobbet, /julfika | Inte på /om (berättelse, inte artikeldatum) |
| Review/Rating/LocalBusiness | – | Avsiktligt utelämnat |

## 10. Local SEO plan (ägare)

- GBP: kategori **Bagerigrossist**, leveransverksamhet utan besöksadress, service areas Tyresö/Nacka/Haninge/Huddinge.
- NAP: Antennvägen 2, Tyresö är enda publika adressen. Lager Radiovägen 19 är inte besöksadress.
- `NEXT_PUBLIC_SAME_AS` = GBP-URL när profilen finns.
- Inga doorway-kommunsidor utanför de fyra vi faktiskt kör till.

## 11. Performance

- LCP: `priority` på hero, produktfoto, prenumeration, fika-guide, julfika, områdeshero, **nu även leveransbilden**.
- Typsnitt: Caslon + Public Sans + Plex Mono (`display: swap`). P3: byt etiketter till Public Sans (−25 kB).
- TTFB: `force-dynamic` överallt. ISR 300 s när produktion når DB.
- Bilder: next/image, WebP/AVIF, `sizes`. Prova-på har nu square+OG som de tre kilovarorna.

## 12. International

Enbart sv-SE. Ingen hreflang. Maskinöversättning skapar inte sidor.

## 13. Content plan

- Oktober: `/julfika` med årets stoppdatum ur admin.
- Ingen ny URL för påsk/fredag/smörkakor.
- Recept publiceras inte.
- När GBP finns: sameAs + ev. recensioner (inga fejkade).

## 14. Implemented this round

- `src/lib/seo/schema.ts` – `DELIVERY_CITIES`, fraktmål fyra kommuner, prova-på bildvarianter
- `src/components/InfoPageSeo.tsx` – FAQPage på infosidor
- `src/app/(site)/page.tsx` – Twitter-kort
- `src/app/(site)/leverans/page.tsx` – H1/schema = title, LCP-priority
- `src/app/(site)/fika-till-jobbet/page.tsx` – kontorsfika (lede, H2, FAQ, description)
- `src/app/(site)/om/page.tsx` + `folkets-kaka/page.tsx` – synlig FAQ + schema
- `src/components/SiteFooter.tsx` – länk Folkets nästa småkaka
- `src/app/llms.txt/route.ts` – kontorsfika
- `public/images/prova-pa-paket-{square,og}.jpg`
- `tests/schema.test.ts` – fraktmål + FAQPage

## 15. Remaining backlog

- **P0** Domän, Search Console, sitemap-inskick, GBP/NAP/sameAs
- **P1** ISR 300 s när produktion har DB (TTFB)
- **P2** FAQ ej mottagen leverans (ägarregel); julfika-stopp i oktober; Plex Mono → Public Sans
- **P3** Engelsk landning + hreflang; Semrush-positioner när domänen är live

## 16. 30 / 60 / 90

- **30:** koppla domän, GSC, skicka sitemap, GBP-utkast, mät TTFB på innehållssidor.
- **60:** ISR på innehåll; julfika-uppdatering; first-party queries i GSC (CTR på titles).
- **90:** utvärdera om “kolakakor”-trafik är recept-intent (då inte jaga mer) eller köp-intent (förstärk PDP). Engelsk sida bara om det finns utländska företagskunder i området.

## 17. KPI baseline (när GSC finns)

Impressions, klick, CTR, snittposition, indexerade vs upptäckta-ej-indexerade, organiska ordrar, branded vs non-branded, LCP/INP/CLS, TTFB. Inget att mäta mot förrän `sockerbagaren.se` är live.
