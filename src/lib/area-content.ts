// Innehåll för lokala landningssidor. Tyresö-texterna kommer från
// designpaketet (Tyreso.dc.html); övriga områden följer samma mönster.
// Ortsnamnen är kommundelar i respektive kommun.

export interface AreaContent {
  slug: string;
  name: string;
  title: string;
  metaDescription: string;
  heroHeading: string;
  heroText: string;
  midHeading: string;
  midText: string;
  faqs: { q: string; a: string }[];
}

export const AREA_CONTENT: Record<string, AreaContent> = {
  tyreso: {
    slug: "tyreso",
    name: "Tyresö",
    title: "Kakor till företag i Tyresö",
    metaDescription:
      "Företagsfika i Tyresö: nybakade småkakor levererade till kontor, verkstäder och butiker i hela kommunen. Betalning mot faktura — vi finns själva på Antennvägen i Tyresö.",
    heroHeading: "Kakor till företag i Tyresö",
    heroText:
      "Vi bakar och levererar fika direkt till arbetsplatser i Tyresö — kontor, verkstäder, butiker och kliniker. Vi finns själva på Antennvägen i Tyresö, så leveransen kommer från grannskapet.",
    midHeading: "Företagsfika i Tyresö",
    midText:
      "Fredagsfika på kontoret vid Tyresö centrum, kundmöte i Bollmora eller personalrum i Trollbäcken — vi kör ut samma sortiment till alla arbetsplatser i kommunen. Återkommande behov? Låt fikat dyka upp av sig självt med en fikaprenumeration.",
    faqs: [
      {
        q: "Vilka delar av Tyresö levererar ni till?",
        a: "Hela kommunen — Bollmora, Trollbäcken, Tyresö strand, Lindalen och övriga områden med företagsadresser.",
      },
      {
        q: "När kommer leveransen?",
        a: "Under dagen på Tyresös leveransdag. Vi kan inte lova exakt klockslag, men adressen ska vara bemannad.",
      },
      {
        q: "Hur snabbt kan vi få kakor?",
        a: "Beställ i checkouten så visar vi nästa tillgängliga leveransdag för Tyresö.",
      },
      {
        q: "Kan vi hämta själva?",
        a: "Kontakta oss så löser vi det — vi finns på Antennvägen 2 i Tyresö.",
      },
    ],
  },
  nacka: {
    slug: "nacka",
    name: "Nacka",
    title: "Kakor till företag i Nacka",
    metaDescription:
      "Företagsfika i Nacka: nybakade småkakor levererade till kontor, butiker och verkstäder i hela kommunen. Betalning mot faktura, lokal leverans från Tyresö.",
    heroHeading: "Kakor till företag i Nacka",
    heroText:
      "Vi bakar och levererar fika direkt till arbetsplatser i Nacka — kontor, verkstäder, butiker och kliniker. Bageriet ligger i grannkommunen Tyresö, så leveransen kommer från närområdet.",
    midHeading: "Företagsfika i Nacka",
    midText:
      "Fredagsfika på kontoret i Sickla, kundmöte i Nacka strand eller personalrum i Orminge — vi kör ut samma sortiment till alla arbetsplatser i kommunen. Återkommande behov? Låt fikat dyka upp av sig självt med en fikaprenumeration.",
    faqs: [
      {
        q: "Vilka delar av Nacka levererar ni till?",
        a: "Hela kommunen — Sickla, Nacka strand, Saltsjöbaden, Orminge, Älta och övriga områden med företagsadresser.",
      },
      {
        q: "När kommer leveransen?",
        a: "Under dagen på Nackas leveransdag. Vi kan inte lova exakt klockslag, men adressen ska vara bemannad.",
      },
      {
        q: "Hur snabbt kan vi få kakor?",
        a: "Beställ i checkouten så visar vi nästa tillgängliga leveransdag för Nacka.",
      },
      {
        q: "Kan vi blanda olika kakor i samma order?",
        a: "Ja — välj vikt per sort och blanda fritt i samma leverans.",
      },
    ],
  },
  haninge: {
    slug: "haninge",
    name: "Haninge",
    title: "Kakor till företag i Haninge",
    metaDescription:
      "Företagsfika i Haninge: nybakade småkakor levererade till kontor, verkstäder och butiker i hela kommunen. Betalning mot faktura, lokal leverans från Tyresö.",
    heroHeading: "Kakor till företag i Haninge",
    heroText:
      "Vi bakar och levererar fika direkt till arbetsplatser i Haninge — kontor, verkstäder, butiker och kliniker. Bageriet ligger i grannkommunen Tyresö, så leveransen kommer från närområdet.",
    midHeading: "Företagsfika i Haninge",
    midText:
      "Fredagsfika på kontoret i Handen, kundmöte i Vega eller personalrum i Västerhaninge — vi kör ut samma sortiment till alla arbetsplatser i kommunen. Återkommande behov? Låt fikat dyka upp av sig självt med en fikaprenumeration.",
    faqs: [
      {
        q: "Vilka delar av Haninge levererar ni till?",
        a: "Hela kommunen — Handen, Vega, Brandbergen, Jordbro, Västerhaninge och övriga områden med företagsadresser.",
      },
      {
        q: "När kommer leveransen?",
        a: "Under dagen på Haninges leveransdag. Vi kan inte lova exakt klockslag, men adressen ska vara bemannad.",
      },
      {
        q: "Hur snabbt kan vi få kakor?",
        a: "Beställ i checkouten så visar vi nästa tillgängliga leveransdag för Haninge.",
      },
      {
        q: "Kan vi blanda olika kakor i samma order?",
        a: "Ja — välj vikt per sort och blanda fritt i samma leverans.",
      },
    ],
  },
  huddinge: {
    slug: "huddinge",
    name: "Huddinge",
    title: "Kakor till företag i Huddinge",
    metaDescription:
      "Företagsfika i Huddinge: nybakade småkakor levererade till kontor, verkstäder och butiker i hela kommunen. Betalning mot faktura, lokal leverans från Tyresö.",
    heroHeading: "Kakor till företag i Huddinge",
    heroText:
      "Vi bakar och levererar fika direkt till arbetsplatser i Huddinge — kontor, verkstäder, butiker och kliniker. Bageriet ligger i Tyresö på andra sidan kommungränsen, så leveransen kommer från närområdet.",
    midHeading: "Företagsfika i Huddinge",
    midText:
      "Fredagsfika på kontoret i Kungens kurva, kundmöte i Flemingsberg eller personalrum i Skogås — vi kör ut samma sortiment till alla arbetsplatser i kommunen. Återkommande behov? Låt fikat dyka upp av sig självt med en fikaprenumeration.",
    faqs: [
      {
        q: "Vilka delar av Huddinge levererar ni till?",
        a: "Hela kommunen — Huddinge centrum, Kungens kurva, Flemingsberg, Skogås, Trångsund och övriga områden med företagsadresser.",
      },
      {
        q: "När kommer leveransen?",
        a: "Under dagen på Huddinges leveransdag. Vi kan inte lova exakt klockslag, men adressen ska vara bemannad.",
      },
      {
        q: "Hur snabbt kan vi få kakor?",
        a: "Beställ i checkouten så visar vi nästa tillgängliga leveransdag för Huddinge.",
      },
      {
        q: "Kan vi blanda olika kakor i samma order?",
        a: "Ja — välj vikt per sort och blanda fritt i samma leverans.",
      },
    ],
  },
};
