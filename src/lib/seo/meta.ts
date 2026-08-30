import type { Metadata } from "next";

// Nexts metadata-merge är grund per toppnyckel: en sida utan egna
// openGraph/twitter ärver rotens FÄRDIGA block (startsidans titel), inte en
// mix. Därför sätter varje publik sida båda blocken via denna hjälpare.
interface SharePreviewInput {
  title: string;
  description: string;
  path: string;
  image?: { url: string; alt: string };
}

export function sharePreview({
  title,
  description,
  path,
  image,
}: SharePreviewInput): Pick<Metadata, "openGraph" | "twitter"> {
  const fullTitle = `${title} — Sockerbagaren`;
  const img = image ?? { url: "/og.jpg", alt: "Sockerbagaren — riktigt fika till jobbet" };
  return {
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: "Sockerbagaren",
      locale: "sv_SE",
      type: "website",
      images: [{ url: img.url, width: 1200, height: 630, alt: img.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [img.url],
    },
  };
}
