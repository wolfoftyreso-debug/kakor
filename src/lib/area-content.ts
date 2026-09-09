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
  /** Valfri intern vidare-länk som renderas under FAQ:n. */
  moreLink?: { href: string; label: string };
}

export const AREA_CONTENT: Record<string, AreaContent> = {
  tyreso: {
    slug: "tyreso",
    name: "Tyresö",
    title: "Kakor till företag i Tyresö",
    metaDescription:
      "Företagsfika i Tyresö: gammaldags småkakor på riktigt smör till kontor, verkstäder och butiker i hela kommunen. Faktura och fasta leveransdagar.",
    heroHeading: "Kakor till företag i Tyresö",
    heroText:
      "Tyresö är vår hemkommun: fryslagret ligger på Radiovägen, och beställningarna till kontor, verkstäder, butiker och kliniker i kommunen plockas därför i samma kommun som de levereras i.",
    midHeading: "Företagsfika i Tyresö",
    midText:
      "Fredagsfika vid Tyresö centrum, kundmöte i Bollmora eller personalrum i Trollbäcken: sortimentet är detsamma vart i kommunen kakorna ska. Arbetsplatser som fikar varje vecka brukar välja fikaprenumerationen, så att leveransen kommer utan att någon behöver beställa.",
    faqs: [
      {
        q: "Vilka delar av Tyresö levererar ni till?",
        a: "Företagsadresser i hela kommunen (kassan bekräftar postnumret) – Bollmora, Trollbäcken, Tyresö strand, Lindalen och övriga områden med företagsadresser.",
      },
      {
        q: "Var finns kakorna innan de levereras i Tyresö?",
        a: "I vårt fryslager på Radiovägen i Tyresö. Kakorna bakas och fryses hos konditoriet i Šiauliai, körs frysta till lagret och plockas där när er beställning kommer in.",
      },
      {
        q: "Kan vi hämta själva i Tyresö?",
        a: "Nej, vi har ingen butik eller utlämning – alla beställningar levereras till en bemannad företagsadress på områdets leveransdag.",
      },
    ],
  },
  nacka: {
    slug: "nacka",
    name: "Nacka",
    title: "Kakor till företag i Nacka",
    metaDescription:
      "Företagsfika i Nacka: gammaldags småkakor på riktigt smör till kontor, verkstäder och butiker i hela kommunen. Faktura och fasta leveransdagar.",
    heroHeading: "Kakor till företag i Nacka",
    heroText:
      "Kontor i Sickla, kliniker i Nacka strand, verkstäder i Orminge: hela Nacka kommun har en fast leveransdag i veckan, med kakorna plockade i fryslagret i grannkommunen Tyresö.",
    midHeading: "Företagsfika i Nacka",
    midText:
      "Sitter ni i ett kontorshus där flera företag delar reception? Skriv företagsnamn och våning i leveransanvisningen i kassan, så hamnar kartongen rätt. Ska fikat komma varje eller varannan vecka är fikaprenumerationen enklast.",
    faqs: [
      {
        q: "Vilka delar av Nacka levererar ni till?",
        a: "Företagsadresser i hela kommunen (kassan bekräftar postnumret) – Sickla, Nacka strand, Saltsjöbaden, Orminge, Älta och övriga områden med företagsadresser.",
      },
      {
        q: "Vi sitter i ett kontorshotell i Nacka – hur hittar leveransen fram?",
        a: "Ange företagsnamn, våning och gärna receptionens namn i leveransanvisningen i kassan. Leveransen lämnas till en bemannad reception eller ett personalrum.",
      },
      {
        q: "Levererar ni till Saltsjöbaden och Älta?",
        a: "Ja, till företagsadresser i hela Nacka kommun. Kassan kontrollerar postnumret innan ni beställer.",
      },
    ],
  },
  haninge: {
    slug: "haninge",
    name: "Haninge",
    title: "Kakor till företag i Haninge",
    metaDescription:
      "Företagsfika i Haninge: gammaldags småkakor på riktigt smör till kontor, verkstäder och butiker i hela kommunen. Faktura och fasta leveransdagar.",
    heroHeading: "Kakor till företag i Haninge",
    heroText:
      "Från Handen och Vega till Jordbro och Västerhaninge: arbetsplatser i Haninge får kakorna på kommunens leveransdag, direkt från fryslagret i grannkommunen Tyresö.",
    midHeading: "Företagsfika i Haninge",
    midText:
      "Verkstäder, lager och kontor i Jordbro, Handen och Vega beställer samma sortiment. Förvara kakorna i stängd förpackning i personalrummet, så håller de sig mjuka till nästa fika. Prova-på-paketet är ett enkelt sätt att se vilken sort som går åt först.",
    faqs: [
      {
        q: "Vilka delar av Haninge levererar ni till?",
        a: "Företagsadresser i hela kommunen (kassan bekräftar postnumret) – Handen, Vega, Brandbergen, Jordbro, Västerhaninge och övriga områden med företagsadresser.",
      },
      {
        q: "Kan leveransen lämnas vid en lastkaj eller port i Haninge?",
        a: "Ja, om någon tar emot den där. Skriv i leveransanvisningen var chauffören ska anmäla sig, till exempel lastkaj eller vaktkur.",
      },
      {
        q: "Hur mycket brukar en verkstad eller ett lager i Haninge beställa?",
        a: "Räkna med 3–5 kakor per person och fika. Kassan visar hur många personer en vald mängd räcker till, och guiden om fika till jobbet räknar på större sällskap.",
      },
    ],
  },
  huddinge: {
    slug: "huddinge",
    name: "Huddinge",
    title: "Kakor till företag i Huddinge",
    metaDescription:
      "Företagsfika i Huddinge: gammaldags småkakor på riktigt smör till kontor, verkstäder och butiker i hela kommunen. Faktura och fasta leveransdagar.",
    heroHeading: "Kakor till företag i Huddinge",
    heroText:
      "Huddinge sträcker sig från handelsområdet i Kungens kurva till sjukhus- och campusområdet i Flemingsberg. Arbetsplatser i hela kommunen får kakorna från fryslagret i Tyresö på kommunens leveransdag.",
    midHeading: "Företagsfika i Huddinge",
    midText:
      "Butiker i Kungens kurva, mottagningar i Flemingsberg och kontor i Skogås och Trångsund beställer samma sortiment: kolasnittar, mandelkubb och chokladsnittar per kilo. Större arbetsplatser med flera fikarum kan lägga separata beställningar per avdelning på samma faktura-e-post.",
    faqs: [
      {
        q: "Vilka delar av Huddinge levererar ni till?",
        a: "Företagsadresser i hela kommunen (kassan bekräftar postnumret) – Huddinge centrum, Kungens kurva, Flemingsberg, Skogås, Trångsund och övriga områden med företagsadresser.",
      },
      {
        q: "Kan flera avdelningar i Huddinge beställa var för sig?",
        a: "Ja. Varje beställning får en egen faktura, så olika avdelningar eller kostnadsställen kan beställa separat med samma organisationsnummer.",
      },
      {
        q: "Levererar ni till Kungens kurva och Flemingsberg?",
        a: "Ja, till företagsadresser i hela Huddinge kommun. Kassan kontrollerar postnumret innan ni beställer.",
      },
    ],
  },
};
