// Crawlerpolicy: sökindexering och modellträning är inte samma sak.
// Ändra inte träning till disallow utan ägarbeslut – standard är att * tillåter
// både sök och träning, med samma spärrar för privata vägar.

export const PRIVATE_PATHS = ["/admin", "/api", "/faktura", "/prenumeration/hantera", "/demo-underlag"] as const;

export const SEARCH_USER_AGENTS = ["Googlebot", "Bingbot", "DuckDuckBot"] as const;

/** Retrieval-botar som hämtar sidor för att svara (inte för att träna modeller). */
export const AI_RETRIEVAL_USER_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Claude-Search",
  "Claude-User",
  "Google-CloudVertexBot",
] as const;

/** Träningsbotar. Tillåtna via * tills verksamheten beslutar att stänga av träning. */
export const AI_TRAINING_USER_AGENTS = [
  "GPTBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
] as const;

export type CrawlerGroup = "search" | "ai-retrieval" | "ai-training";
export type CrawlerAccess = "allow" | "disallow";

export interface CrawlerPolicyRow {
  crawler: string;
  group: CrawlerGroup;
  policy: CrawlerAccess;
  reason: string;
}

export const CRAWLER_POLICY: CrawlerPolicyRow[] = [
  {
    crawler: "Googlebot",
    group: "search",
    policy: "allow",
    reason: "Google Search-indexering. Privata vägar spärras.",
  },
  {
    crawler: "Bingbot",
    group: "search",
    policy: "allow",
    reason: "Bing-indexering. Privata vägar spärras.",
  },
  {
    crawler: "DuckDuckBot",
    group: "search",
    policy: "allow",
    reason: "DuckDuckGo-indexering. Privata vägar spärras.",
  },
  {
    crawler: "OAI-SearchBot / ChatGPT-User",
    group: "ai-retrieval",
    policy: "allow",
    reason: "ChatGPT-sök och livehämtning. Inte GPTBot (träning).",
  },
  {
    crawler: "PerplexityBot",
    group: "ai-retrieval",
    policy: "allow",
    reason: "Svarscrawl i Perplexity. Vill synas i AI-sök.",
  },
  {
    crawler: "Claude-Search / Claude-User",
    group: "ai-retrieval",
    policy: "allow",
    reason: "Claude-sök och livehämtning. Inte ClaudeBot (träning).",
  },
  {
    crawler: "Google-CloudVertexBot",
    group: "ai-retrieval",
    policy: "allow",
    reason: "Google AI-översikter som hämtar sidan live.",
  },
  {
    crawler: "GPTBot / Google-Extended / CCBot / ClaudeBot / Applebot-Extended",
    group: "ai-training",
    policy: "allow",
    reason: "Modellträning är tillåten via * tills ägaren beslutar att stänga av. Det är inte samma sak som sökindexering.",
  },
];
