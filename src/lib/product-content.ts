// Kunskapsinnehåll per produkt — generell, verifierbar bakkunskap
// (synonymer, servering, förvaringsråd). Här får det ALDRIG stå
// verksamhetsfakta (produktionssätt, tider, löften) — sådant styrs av
// verksamheten. Sökdata (Semrush, se-databasen, 2026-09) motiverar urvalet:
// "kolakakor" 33 100 sök/mån, "kolasnittar" 22 200, "snittar" 8 100,
// "chokladsnittar" 8 100, "mandelkubb" 4 400, "mandelkubbar" 4 400,
// "sega kolasnittar" 880, "gammaldags småkakor" 1 600, förvaringsfrågor.

export interface ProductKnowledge {
  heading: string;
  paragraphs: string[];
  /** Kort synonymfras som vävs in i meta description ("kallas även …"). */
  aka?: string;
  /** Synonym i sidtiteln, inom parentes: "Kolasnittar (kolakakor)". */
  titleAka?: string;
  /** Vanliga frågor — renderas synligt och som FAQPage-schema. */
  faqs?: { q: string; a: string }[];
}

export const PRODUCT_KNOWLEDGE: Record<string, ProductKnowledge> = {
  kolasnittar: {
    aka: "kallas även kolakakor",
    titleAka: "kolakakor",
    heading: "Om kolasnittar",
    paragraphs: [
      "Kolasnittar kallas ofta även kolakakor eller kolakex — en av de mest älskade klassikerna i svenska kakburkar. Den karaktäristiska sega kolasmaken kommer från sirap och smör som karamelliseras i ugnen, och snittarna skärs traditionellt diagonalt medan kakan fortfarande är varm.",
      "Sega kolasnittar får sin konsistens av just sirapen: ju mer sirap i förhållande till mjöl, desto segare kärna, medan kanterna blir spröda. En liten mängd salt lyfter kolasmaken — därför bakas våra kolasnittar med keltiskt salt i degen.",
      "Kolasnittar hör till familjen snittkakor: degen rullas till längder, plattas till, gräddas och skärs i sneda bitar. Samma teknik används för chokladsnittar, vilket gör de två sorterna till ett naturligt par på fikabordet.",
      "Förvaringstips: kolasnittar håller sig bäst i en tät burk i rumstemperatur, gärna med bakplåtspapper mellan lagren så att de inte fastnar i varandra. De går utmärkt att frysa — låt dem tina i rumstemperatur en stund före serveringen.",
    ],
    faqs: [
      {
        q: "Är kolasnittar och kolakakor samma sak?",
        a: "I praktiken ja. Kolasnittar är det traditionella namnet på den snittade sirapskakan, medan kolakakor används både om snittarna och om runda varianter av samma deg. Söker ni kolakakor till fikat är det de här ni vill ha.",
      },
      {
        q: "Hur länge håller kolasnittar?",
        a: "I tät burk i rumstemperatur håller de sig fina i flera veckor. I frysen håller de i flera månader — tina i rumstemperatur före serveringen.",
      },
      {
        q: "Kan vi beställa kolasnittar till företaget?",
        a: "Ja — kolasnittar säljs per kilo till företag i Tyresö, Nacka, Haninge och Huddinge, med leverans på områdets leveransdag och betalning mot faktura. Blanda gärna med mandelkubb och chokladsnittar i samma order.",
      },
    ],
  },
  mandelkubb: {
    aka: "även mandelkubbar",
    titleAka: "mandelkubbar",
    heading: "Om mandelkubb",
    paragraphs: [
      "Mandelkubb — eller mandelkubbar i plural — är en rejäl svensk klassiker: en mör, kompakt kaka smaksatt med mandel och ofta en ton av bittermandel. Den har en naturlig plats bredvid en kopp svart kaffe och är en av de kaksorter som oftast förknippas med klassiskt svenskt kondis.",
      "Till skillnad från de tunna snittkakorna är mandelkubben en formad kaka med ordentlig tuggmotstånd — mer kaka per bit och mer mättande. Det gör den till ett bra val när fikat ska räcka länge, till exempel i personalrummet eller på ett längre möte.",
      "Mandelkubb och mandelkakor förväxlas ibland. Mandelkakor är ett samlingsnamn för alla småkakor med mandel, medan mandelkubben är just den höga, kubbformade kakan med ägg och mandel i degen.",
      "Förvaringstips: mandelkubb håller sig mör i tät burk i rumstemperatur. Den tål frysning mycket bra — frys i tät påse och låt tina i rumstemperatur, så smakar den som ny.",
    ],
    faqs: [
      {
        q: "Vad är skillnaden mellan mandelkubb och mandelkakor?",
        a: "Mandelkakor är ett samlingsnamn för småkakor med mandel. Mandelkubb är en specifik sort: en hög, kubbformad kaka med mandel och ägg i degen som är mör och mättande.",
      },
      {
        q: "Innehåller mandelkubb nötter?",
        a: "Mandelkubb innehåller mandel, som räknas till nötter i allergensammanhang. Fullständig ingrediensförteckning och allergener finns på produktsidan och under Ingredienser & allergener.",
      },
      {
        q: "Hur länge håller mandelkubb?",
        a: "Flera veckor i tät burk i rumstemperatur och flera månader i frysen. Tina i rumstemperatur före serveringen.",
      },
    ],
  },
  chokladsnittar: {
    aka: "chokladiga snittkakor",
    heading: "Om chokladsnittar",
    paragraphs: [
      "Chokladsnittar är kolasnittarnas chokladiga syskon — en skuren småkaka på mördeg med kakao, ofta toppad med pärlsocker. Snittkakor är en egen familj i det svenska kakbaket: degen kavlas i längder, grädds och skärs i diagonala bitar.",
      "Våra chokladsnittar bakas med både mörk choklad och kakao, vilket ger en djupare chokladkaraktär än snittar med enbart kakao. Ljus sirap ger den runda sötman och en seg kärna — samma princip som i kolasnittarna, men med chokladen i fokus.",
      "Chokladsnittar är den av våra sorter som oftast väljs som chokladkaka till kaffet: chokladig utan att vara tung, och lätt att dela ut på ett fat till många.",
      "Förvaringstips: förvara i tät burk i rumstemperatur, separera lagren med bakplåtspapper. Chokladsnittar går bra att frysa och tinar snabbt i rumstemperatur.",
    ],
    faqs: [
      {
        q: "Vad är skillnaden mellan chokladsnittar och kolasnittar?",
        a: "Samma bakteknik — snittade längder — men chokladsnittar bakas med choklad och kakao i degen medan kolasnittar får sin smak av karamelliserad sirap och smör. Många beställer båda så att fikat får en ljus och en mörk sort.",
      },
      {
        q: "Hur länge håller chokladsnittar?",
        a: "Flera veckor i tät burk i rumstemperatur och flera månader i frysen. Tina i rumstemperatur före serveringen.",
      },
      {
        q: "Kan vi beställa chokladsnittar till kontoret?",
        a: "Ja — chokladsnittar säljs per kilo till företag i Tyresö, Nacka, Haninge och Huddinge, med leverans på områdets leveransdag och betalning mot faktura.",
      },
    ],
  },
  "prova-pa-paket": {
    heading: "Om prova-på-paketet",
    paragraphs: [
      "Prova-på-paketet är det enkla sättet att låta arbetsplatsen smaka hela sortimentet innan ni bestämmer favorit: 0,5 kg vardera av mandelkubb, kolasnittar och chokladsnittar — 1,5 kg gammaldags småkakor på riktigt smör.",
      "Tre sorter ger också en bra spridning på fikabordet: en mör och mättande kaka (mandelkubb), en seg kolakaka (kolasnittar) och en chokladkaka (chokladsnittar). När ni vet vad som går åt först är det lätt att beställa den sorten per kilo nästa gång.",
    ],
    faqs: [
      {
        q: "Hur många personer räcker prova-på-paketet till?",
        a: "Räkna med 3–5 småkakor per person till en fika. Hur många kakor 1,5 kg ger beror på sorten — snittar är lätta och mandelkubb tyngre — så paketet är ett bra sätt att se hur långt det räcker hos just er.",
      },
      {
        q: "Kan vi blanda paketet med kakor per kilo i samma order?",
        a: "Ja. Lägg paketet i korgen och komplettera med valfri sort per kilo — allt levereras tillsammans på områdets leveransdag och faktureras på samma faktura.",
      },
    ],
  },
};
