// 301-alias för URL:er som människor (och ibland länkar) kan skriva.
// Destinationssidorna är de kanoniska – inga dubbletter, inga doorway-sidor.
// Nya alias 2026-09: observerade kommersiella queries utan egen kanonisk URL.

export interface SeoAlias {
  source: string;
  destination: string;
}

export const SEO_ALIASES: SeoAlias[] = [
  { source: "/faq", destination: "/vanliga-fragor" },
  { source: "/foretagsfika", destination: "/fika-till-jobbet" },
  { source: "/kontorsfika", destination: "/fika-till-jobbet" },
  { source: "/fika-till-foretaget", destination: "/fika-till-jobbet" },
  { source: "/fredagsfika", destination: "/fika-till-jobbet" },
  { source: "/produkter", destination: "/kakor" },
  { source: "/produkter/:slug", destination: "/kakor/:slug" },
  { source: "/kakor-till-kontoret", destination: "/kakor" },
  { source: "/kakor-till-foretaget", destination: "/kakor" },
  { source: "/kolakakor", destination: "/kakor/kolasnittar" },
  { source: "/mandelkubbar", destination: "/kakor/mandelkubb" },
  { source: "/fikaprenumeration", destination: "/prenumeration" },
  { source: "/fikaabonnemang", destination: "/prenumeration" },
  { source: "/leveransomrade", destination: "/leverans" },
  { source: "/om-oss", destination: "/om" },
  { source: "/foretagsfika-tyreso", destination: "/tyreso" },
  { source: "/foretagsfika-nacka", destination: "/nacka" },
  { source: "/foretagsfika-haninge", destination: "/haninge" },
  { source: "/foretagsfika-huddinge", destination: "/huddinge" },
];
