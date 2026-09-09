# SEO-revision 7 – Sockerbagaren

Skriven 9 september 2026. Bygger på revision sex (`docs/SEO-REVISION-6.md`). Search Console finns inte – domänen är inte kopplad. Sökdata: Semrush se 2026-09 (citerad i sidkommentarer) plus SERP-observation av kontorsgrossister (Kontorab, Swedoffice, Torebrings). Inga påhittade affärsfakta, inga doorway-sidor, ingen schema för innehåll som inte syns.

## 1. Executive summary

**Score: 86 / 100** (revision sex 82; den här omgången tar bort P1-luckor i merchant-schema och täcker sökfrasen *kakor till kontoret* utan ny URL).

Sajten är crawlbar, self-canonical, unik title/description, FAQPage där frågor visas, Product+Offer med B2B-pris och nu giltig returpolicy plus ursprung. Fraktmål använder postnummerprefix från admin (Google DefinedRegion för SE), inte ogiltig `addressLocality`. Plex Mono-webbtypsnittet är borta. Det som sänker betyget är oförändrat: ingen Search Console, ingen GBP, de flesta sidor fortfarande `force-dynamic` (TTFB), Semrush-enheter slut.

## 2. Critical issues (P0/P1)

| Prio | Issue | Status |
|---|---|---|
| P1 | Product/Organization saknade `hasMerchantReturnPolicy` (Google merchant listing) | **Fixat** – `MerchantReturnNotPermitted`, speglar /villkor |
| P1 | `Offer.shippingDestination` använde `addressLocality` (inte giltigt DefinedRegion i SE) | **Fixat** – postnummerprefix ur admin |
| P1 | Ursprung synligt på PDP men saknades i Product-schema | **Fixat** – `countryOfOrigin: Litauen` |
| P1 | Startsida/kategori/PDP kunde visa inaktuellt kataloginnehåll efter admin-ändring om ISR slås på | **Fixat** – `revalidatePublicCatalog()` + tagg `delivery-days` |
| P0 | Search Console / sitemap-inskick | Blockerat: domän sist |
| P0 | Google Business Profile + NAP/sameAs | Blockerat: ägare |

Inga 4xx/5xx, redirect loops, conflicting canonicals eller index-bloat (20 sitemap-URL:er).

## 3. Technical SEO

- **Crawl:** 20 indexerbara URL:er. `/admin`, `/api`, `/faktura`, `/prenumeration/hantera` i robots.txt. Preview `noindex`. www→apex 301.
- **Rendering:** `(site)`-layouten är `force-dynamic` (demo-byggets SQLite finns under seed, inte under `next build`:s statiska generering). Leveransdagar i footern är `unstable_cache` 300 s i runtime. Full ISR på katalogsidor väntar tills produktionsbygget når databasen.
- **JS-SEO:** RSC/SSR – SEO-text finns i initial HTML.
- **Hreflang:** ingen. En språkversion (sv-SE).
- **Sitemap:** `lastModified` även för /kakor, /om, /leverans, /prenumeration, /ingredienser, /villkor, /integritet och de fyra områdessidorna (`CONTENT_DATES`).
- **Typsnitt:** Caslon + Public Sans (`display: swap`). IBM Plex Mono-webbtypsnittet är borttaget; etiketter använder system-mono.

## 4. Keyword universe (Semrush se, 2026-09 + SERP)

| Query | Vol/mån | Intent | Primär URL |
|---|---|---|---|
| kolakakor | 33 100 | info/recept | `/kakor/kolasnittar` |
| kolasnittar | 22 200 | info + kommersiell | `/kakor/kolasnittar` |
| kakor | 14 800 | blandad | `/kakor` |
| småkakor | 8 100 | kategori | `/kakor` |
| chokladsnittar / snittar | 8 100 | produkt | `/kakor/chokladsnittar` |
| mandelkubb(ar) | 4 400 | produkt | `/kakor/mandelkubb` |
| smörkakor | 1 900 | kategori | `/kakor` body |
| gammaldags småkakor | 1 600 | kategori | `/kakor` H1 |
| julfika | 1 600 | säsong | `/julfika` |
| fika till jobbet / fredagsfika | 320 | B2B | `/fika-till-jobbet` |
| kontorsfika | SERP-synonym | B2B | `/fika-till-jobbet` (rev 6) |
| **kakor till kontoret** | SERP: Kontorab, Swedoffice rankar | B2B transaktionell | `/fika-till-jobbet` + `/kakor` **nu** |
| småkakor per kilo | long-tail B2B | transaktionell | `/kakor` **nu** (H2 + FAQ) |

Recept-intent på *kolakakor* jagas inte med egna URL:er (ägarbeslut).

## 5. Search intent map

Oförändrad från revision sex. `kakor till kontoret` och `småkakor per kilo` lagda som H2/FAQ på befintliga kommersiella sidor – inte egna URL:er (skulle kannibalisera `/kakor` och `/fika-till-jobbet`).

## 6. Content gap map

| Gap | Beslut |
|---|---|
| kakor till kontoret | **Stängd:** H2 + lede på `/fika-till-jobbet`, H2 + FAQ på `/kakor` |
| småkakor per kilo | **Stängd:** H2 på `/kakor` |
| Merchant return schema | **Stängd:** ingen ångerrätt, synligt i /villkor |
| countryOfOrigin | **Stängd:** samma text som PDP-raden Ursprung |
| Ej mottagen leverans | Blockerat: ägarregel saknas |
| Julfika 2026-stopp | Oktober, data ur admin |
| Engelska | P3, egen omgång |
| Receptsidor | **Nej.** |

## 7. Page → keyword map

Se §4. Primär konvertering: beställning mot faktura. Sekundär: prenumeration, röstning, guide → kassa.

## 8. Internal linking

Oförändrad chrome från revision sex (`/folkets-kaka` i footern). Ny kontextuell copy på `/kakor` pekar fortfarande till guiden och julfika.

## 9. Structured data map

| Typ | Var | Kommentar |
|---|---|---|
| Organization | layout | Logo som ImageObject 512². `knowsAbout` = ämnen på sajten. `hasMerchantReturnPolicy`. Inte Bakery/LocalBusiness. |
| WebSite | layout | Ingen SearchAction. |
| Product + Offer | produkter, listor | `countryOfOrigin` Litauen. `itemCondition` NewCondition. Fraktmål = postnummerprefix. Returpolicy. |
| MerchantReturnPolicy | org + offer | `@id` `/#return-policy`, länk till /villkor |
| FAQPage | oförändrat + ny fråga på /kakor | Samma text som `<details>` |
| Review/Rating/LocalBusiness | – | Avsiktligt utelämnat |

## 10. Local SEO plan (ägare)

Oförändrad: GBP Bagerigrossist, service areas fyra kommuner, Antennvägen 2 enda publika adressen, `NEXT_PUBLIC_SAME_AS` när profil-URL finns.

## 11. Performance

- LCP: oförändrat från rev 6 (`priority` på hero, PDP, guide, jul, områden, leverans).
- Typsnitt: ett webbtypsnitt mindre (Plex Mono). Etiketter i system-mono, samma versaler/letter-spacing.
- TTFB: leveransdagar cachade 300 s. Layouten förblir `force-dynamic` – ISR på katalog väntar på produktions-DB.
- Bilder: next/image, WebP/AVIF. Inga nya tunga original.

## 12. International

Enbart sv-SE. Ingen hreflang.

## 13. Content plan

- Oktober: `/julfika` med årets stoppdatum ur admin.
- Ingen ny URL för påsk/fredag/smörkakor/kakor-till-kontoret.
- Recept publiceras inte.
- När GBP finns: sameAs.

## 14. Implemented this round

- `src/lib/seo/schema.ts` – returpolicy, logo ImageObject, knowsAbout, countryOfOrigin, itemCondition, fraktmål via postnummer
- `src/lib/products.ts` – `unstable_cache` på leveransdagar, `getDeliveryPostalPrefixes`
- `src/app/(site)/layout.tsx` – returpolicy-noden i @graph (layouten förblir `force-dynamic`)
- `src/app/(site)/page.tsx`, `kakor/page.tsx`, `kakor/[slug]/page.tsx` – postnummer till Product-schema
- `src/app/(site)/kakor/page.tsx` – H2 småkakor per kilo, FAQ kakor till kontoret
- `src/app/(site)/fika-till-jobbet/page.tsx` – kakor till kontoret (lede, H2, description)
- `src/app/(site)/villkor/page.tsx`, `integritet/page.tsx` – längre, användbara descriptions
- `src/lib/seo/content-dates.ts` – lastmod för fler sidor; om/prenumeration/ingredienser skickar dateModified
- `src/app/layout.tsx` + `globals.css` – Plex Mono-webbtypsnitt bort
- `src/app/admin/actions.ts` – `revalidatePublicCatalog` + `revalidateTag("delivery-days")`
- `src/app/llms.txt/route.ts` – kakor till kontoret
- `tests/schema.test.ts` – retur, ursprung, postnummer, logo

## 15. Remaining backlog

- **P0** Domän, Search Console, sitemap-inskick, GBP/NAP/sameAs
- **P1** ISR 300 s på katalogsidor när produktion har DB (ta bort `force-dynamic` på /, /kakor, PDP, områden)
- **P2** FAQ ej mottagen leverans (ägarregel); julfika-stopp i oktober
- **P3** Engelsk landning + hreflang; Semrush-positioner när domänen är live

## 16. 30 / 60 / 90

- **30:** koppla domän, GSC, skicka sitemap, GBP-utkast. Bekräfta merchant listing i Rich Results Test (retur + frakt).
- **60:** ISR på katalog; julfika-uppdatering; first-party queries i GSC (CTR på “kakor till kontoret” / kolasnittar).
- **90:** utvärdera om “kolakakor”-trafik är recept-intent. Engelsk sida bara om utländska företagskunder i området.

## 17. KPI baseline (när GSC finns)

Impressions, klick, CTR, snittposition, indexerade vs upptäckta-ej-indexerade, organiska ordrar, branded vs non-branded, LCP/INP/CLS, TTFB. Inget att mäta mot förrän `sockerbagaren.se` är live.
