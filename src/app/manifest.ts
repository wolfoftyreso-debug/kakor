import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

// Web app manifest: ger Android/Chrome rätt namn, ikon och färger vid
// "lägg till på hemskärmen" och i vissa sökytor. Ikonerna är full-bleed
// (maskable-säkra) varianter av logotypen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sockerbagaren",
    short_name: "Sockerbagaren",
    description: siteConfig.description,
    start_url: "/",
    display: "browser",
    background_color: "#FAF5EA",
    theme_color: "#FAF5EA",
    icons: [
      { src: "/images/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
