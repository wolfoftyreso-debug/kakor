import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteConfig } from "@/lib/config";
import { AREA_CONTENT } from "@/lib/area-content";

// Dynamisk sitemap: produktsidorna hämtas ur databasen med RIKTIGA
// lastModified (produktens updatedAt) — datum fejkas aldrig per deploy.
// Om databasen är onåbar levereras de statiska sidorna ändå.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");

  const staticPages = [
    { path: "", priority: 1.0 },
    { path: "/kakor", priority: 0.9 },
    { path: "/bestall", priority: 0.9 },
    { path: "/prenumeration", priority: 0.9 },
    { path: "/fika-till-jobbet", priority: 0.7 },
    { path: "/leverans", priority: 0.6 },
    { path: "/ingredienser", priority: 0.5 },
    { path: "/om", priority: 0.5 },
    { path: "/villkor", priority: 0.3 },
    { path: "/integritet", priority: 0.3 },
  ];
  const areaPages = Object.keys(AREA_CONTENT).map((slug) => ({ path: `/${slug}`, priority: 0.8 }));

  const entries: MetadataRoute.Sitemap = [...staticPages, ...areaPages].map((p) => ({
    url: `${base}${p.path}`,
    changeFrequency: "weekly" as const,
    priority: p.priority,
  }));

  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const p of products) {
      entries.push({
        url: `${base}/kakor/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error("Sitemap: kunde inte hämta produkter:", e);
  }

  return entries;
}
