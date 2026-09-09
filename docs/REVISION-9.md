# Revision 9 – full genomgång 9 september 2026

Ifrågasatte lager, kassa, prenumeration, faktura, SEO och admin. Testade
acceptansscenariot A/B/C end-to-end. Inga doorway-sidor, inga påhittade
affärsfakta.

## Vad som var trasigt (och är lagat)

### P0 – onsdagscutoff nådde aldrig kunden
Framförhållning 2 dagar + `today + lead + 1` stängde torsdagen redan på tisdag.
Onsdag kl 12 var död kod. Kassan håller nu nästa leveransdag öppen fram till
cutoff (`leadTimeAllowingNextDelivery`). Verifierat live: torsdag 10 september
syns i kassan på onsdag förmiddag.

### P0 – prenumerationer syntes inte i leveransveckan förrän cron
Kund A med 2 kg kolasnittar skapade bara avtalet. Första ordern materialiseras
nu vid start (API, horisont 4 dagar) och före både manuell och cron-låsning.
Horisont 10 dagar på lås-cronen fakturerade nästa vecka för tidigt – sänkt till 4.

### P0 – lagerläckage
- PROBLEM efter plock reserverade kakor som redan lämnat frysen.
- Avbruten PROBLEM-order återställde inte fysiskt saldo.
- “Markera som levererad” drog lagret i en annan transaktion och svalde fel.
- Två samtidiga plock kunde skriva över varandra (increment + P2002 på
  `ensureInventory`).

### P1 – låsning var inte immutable under fel
Två LOCKING-finaliserare kunde skriva över snapshoten. PDF-fel efter LOCKED
öppnade veckan igen med kvarvarande JSON. Nu: `updateMany` där status är
LOCKING, snapshot rensas bara om vi fortfarande är i LOCKING, UI litar på
snapshot enbart i låsta tillstånd.

### P1 – driftmejl markerades skickat utan mottagare
Tom driftadress returnerade success. Nu syns felet i veckovyn.

### P1 – övrigt som bröt tydlighet eller sanning
- Exempellager seedades även mot Neon. Bara SQLite-demo får startsaldo.
- Inaktiva sorter försvann från lager-UI.
- Faktura-PDF klippte ränta/kredittext (`lineBreak: false`).
- Omskickad faktura visade originalbelopp efter delkredit.
- Förfallen-flagga ignorerade delkredit.
- Hanteringstoken kunde läcka till GA4 `page_location`.
- “hembakat” på startsidan (policy).
- Tom daglista i kassan utan förklaring.
- Prenumeration kunde startas på fullbokad dag.
- Idempotens för prenumeration ignorerade fakturaadress.
- `hashIp` saltades med adminlösenord.

## Acceptansscenario (A/B/C) – kört end-to-end

1. Kund A prenumeration 2 kg kolasnittar
2. Kund B 3 kg mandelkubb
3. Kund C 1 kg chokladsnittar
4. Alla tre i torsdagens lista (10 sep 2026)
5. Lager reserveras
6. Produktionsunderskott mandelkubb syns
7–9. Låsning skapar immutable snapshot
10–12. Leveranslista, plocklista och leveranssedlar som PDF
13. Driftmejl med tre bilagor
15. Plockad → Lastad → Levererad, fysiskt saldo dras vid plock
17. Veckan ligger kvar i historiken

**18/18 PASS** i `scripts/e2e/warehouse-revision.mts`.

SEO-crawl mot sajten: 21 URL:er, 0 fel.

## Vad som fortfarande är ägarsteg

- Domän, GSC, Bing, GBP (admin Sök visar UNKNOWN – det är rätt).
- Bankgiro, momsnummer, telefon, fakturamejl.
- ISR när produktion når databasen (layouten är force-dynamic).

## Medvetet inte gjort

- Koppla `InStock` till lagersaldo förrän saldot är driftsatt mot Google.
- Extra doorway-sidor per kommun eller “kakor till kontoret”.
- Engelska / hreflang.
- Snapshot av `packageWeightGrams` på orderrad (paketvikt läses från produkten).
