import { siteConfig } from "@/lib/config";

// llms.txt: en kort, maskinläsbar beskrivning av vem vi är, vad vi säljer och
// var vi levererar, för AI-sök och assistenter. Bara uppgifter som redan står
// på sajten – inga påståenden som inte finns på en sida.
export const dynamic = "force-static";

export function GET() {
  const base = siteConfig.url.replace(/\/$/, "");
  const body = `# Sockerbagaren

> Sockerbagaren säljer gammaldags svenska småkakor på riktigt smör till företag i södra Stockholm (Tyresö, Nacka, Haninge, Huddinge). Kakorna säljs per kilo och per paket, levereras på fasta leveransdagar till bemannade företagsadresser och betalas mot faktura. Verksamheten drivs av Landvex AB.

## Vad vi säljer
- Kolasnittar, mandelkubb och chokladsnittar per kilo samt ett prova-på-paket om 1,5 kg: ${base}/kakor
- Fikaprenumeration – samma beställning återkommer varje, varannan eller var fjärde vecka, ingen bindningstid: ${base}/prenumeration
- Beställning och priser: ${base}/bestall

## Vem det är för
- Företag och arbetsplatser: kontor, verkstäder, butiker, kliniker. Betalning endast mot faktura.

## Var vi levererar
- Tyresö: ${base}/tyreso
- Nacka: ${base}/nacka
- Haninge: ${base}/haninge
- Huddinge: ${base}/huddinge
- Så går leveransen till: ${base}/leverans

## Hur kakorna görs
- Recept från Svenskt konditorlexikon. Smör, aldrig margarin. Ingredienser och allergener: ${base}/ingredienser
- Bakas och förpackas hos ett litet konditori i Šiauliai, Litauen, fryses direkt efter bakningen och lagras i fryslager i Tyresö.
- Om företaget och grundaren: ${base}/om

## Guider
- Fika till jobbet och kontorsfika, mängd per person: ${base}/fika-till-jobbet
- Julfika på jobbet: ${base}/julfika
- Folkets nästa småkaka – kunderna röstar fram nästa recept: ${base}/folkets-kaka

## Villkor
- Köp- och leveransvillkor: ${base}/villkor
- Integritetspolicy: ${base}/integritet
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
