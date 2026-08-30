// Kunskapsinnehåll per produkt — generell, verifierbar bakkunskap
// (synonymer, servering, förvaringsråd). Här får det ALDRIG stå
// verksamhetsfakta (produktionssätt, tider, löften) — sådant styrs av
// verksamheten. Sökdata (Semrush, se-databasen) motiverar urvalet:
// "kolakakor" 33 100 sök/mån, "mandelkubbar" 4 400, förvaringsfrågor
// är de vanligaste kakfrågorna.

export interface ProductKnowledge {
  heading: string;
  paragraphs: string[];
  /** Kort synonymfras som vävs in i meta description ("kallas även …"). */
  aka?: string;
}

export const PRODUCT_KNOWLEDGE: Record<string, ProductKnowledge> = {
  kolasnittar: {
    aka: "kallas även kolakakor",
    heading: "Om kolasnittar",
    paragraphs: [
      "Kolasnittar kallas ofta även kolakakor eller kolakex — en av de mest älskade klassikerna i svenska kakburkar. Den karaktäristiska sega kolasmaken kommer från sirap och smör som karamelliseras i ugnen, och snittarna skärs traditionellt diagonalt medan kakan fortfarande är varm.",
      "Förvaringstips: kolasnittar håller sig bäst i en tät burk i rumstemperatur, gärna med bakplåtspapper mellan lagren så att de inte fastnar i varandra. De går utmärkt att frysa — låt dem tina i rumstemperatur en stund före serveringen.",
    ],
  },
  mandelkubb: {
    aka: "även mandelkubbar",
    heading: "Om mandelkubb",
    paragraphs: [
      "Mandelkubb — eller mandelkubbar i plural — är en rejäl svensk klassiker: en mör, kompakt kaka smaksatt med mandel och ofta en ton av bittermandel. Den har en naturlig plats bredvid en kopp svart kaffe och är en av de kaksorter som oftast förknippas med klassiskt svenskt kondis.",
      "Förvaringstips: mandelkubb håller sig mör i tät burk i rumstemperatur. Den tål frysning mycket bra — frys i tät påse och låt tina i rumstemperatur, så smakar den som ny.",
    ],
  },
  chokladsnittar: {
    heading: "Om chokladsnittar",
    paragraphs: [
      "Chokladsnittar är kolasnittarnas chokladiga syskon — en skuren småkaka på smördeg med kakao, ofta toppad med pärlsocker. Snittkakor är en egen familj i det svenska kakbaket: degen kavlas i längder, grädds och skärs i diagonala bitar.",
      "Förvaringstips: förvara i tät burk i rumstemperatur, separera lagren med bakplåtspapper. Chokladsnittar går bra att frysa och tinar snabbt i rumstemperatur.",
    ],
  },
};
