// Publicerings- och uppdateringsdatum för redaktionella sidor. Används av
// sidornas Article-schema OCH sitemapens lastModified, så att de aldrig
// glider isär. Uppdatera "updated" när innehållet ändras i sak – inte per deploy.
export const CONTENT_DATES = {
  "/": { published: "2026-08-29", updated: "2026-09-09" },
  "/fika-till-jobbet": { published: "2026-09-02", updated: "2026-09-09" },
  "/julfika": { published: "2026-09-03", updated: "2026-09-05" },
  "/folkets-kaka": { published: "2026-09-08", updated: "2026-09-09" },
  "/kakor": { published: "2026-08-29", updated: "2026-09-09" },
  "/leverans": { published: "2026-09-05", updated: "2026-09-09" },
  "/om": { published: "2026-09-07", updated: "2026-09-09" },
  "/prenumeration": { published: "2026-09-02", updated: "2026-09-09" },
  "/ingredienser": { published: "2026-08-29", updated: "2026-09-05" },
  "/villkor": { published: "2026-09-02", updated: "2026-09-02" },
  "/integritet": { published: "2026-09-02", updated: "2026-09-02" },
  "/vanliga-fragor": { published: "2026-09-09", updated: "2026-09-09" },
  "/tyreso": { published: "2026-09-05", updated: "2026-09-09" },
  "/nacka": { published: "2026-09-05", updated: "2026-09-09" },
  "/haninge": { published: "2026-09-05", updated: "2026-09-09" },
  "/huddinge": { published: "2026-09-05", updated: "2026-09-09" },
} as const;
