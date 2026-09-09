// Publicerings- och uppdateringsdatum för redaktionella sidor. Används av
// sidornas Article-schema OCH sitemapens lastModified, så att de aldrig
// glider isär. Uppdatera "updated" när innehållet ändras i sak – inte per deploy.
export const CONTENT_DATES = {
  "/fika-till-jobbet": { published: "2026-09-02", updated: "2026-09-09" },
  "/julfika": { published: "2026-09-03", updated: "2026-09-05" },
  "/folkets-kaka": { published: "2026-09-08", updated: "2026-09-09" },
} as const;
