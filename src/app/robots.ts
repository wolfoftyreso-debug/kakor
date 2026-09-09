import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";
import { AI_RETRIEVAL_USER_AGENTS, PRIVATE_PATHS, SEARCH_USER_AGENTS } from "@/lib/seo/crawlers";

function rule(userAgent: string) {
  return {
    userAgent,
    allow: "/",
    disallow: [...PRIVATE_PATHS],
  };
}

export default function robots(): MetadataRoute.Robots {
  let host: string | undefined;
  try {
    const hostname = new URL(siteConfig.url).hostname.replace(/^www\./, "");
    if (hostname === "sockerbagaren.se") host = "https://sockerbagaren.se";
  } catch {
    host = undefined;
  }

  return {
    rules: [
      rule("*"),
      ...SEARCH_USER_AGENTS.map(rule),
      ...AI_RETRIEVAL_USER_AGENTS.map(rule),
    ],
    sitemap: `${siteConfig.url.replace(/\/$/, "")}/sitemap.xml`,
    ...(host ? { host } : {}),
  };
}
