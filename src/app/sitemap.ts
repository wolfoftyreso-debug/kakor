import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";
import { AREA_CONTENT } from "@/lib/area-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const staticPages = [
    { path: "", priority: 1.0 },
    { path: "/bestall", priority: 0.9 },
    { path: "/prenumeration", priority: 0.9 },
    { path: "/leverans", priority: 0.6 },
    { path: "/ingredienser", priority: 0.5 },
    { path: "/om", priority: 0.5 },
    { path: "/villkor", priority: 0.3 },
    { path: "/integritet", priority: 0.3 },
  ];
  const areaPages = Object.keys(AREA_CONTENT).map((slug) => ({ path: `/${slug}`, priority: 0.8 }));

  return [...staticPages, ...areaPages].map((p) => ({
    url: `${base}${p.path}`,
    changeFrequency: "weekly" as const,
    priority: p.priority,
  }));
}
