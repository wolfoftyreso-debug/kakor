import type { Metadata } from "next";
import { IBM_Plex_Mono, Libre_Caslon_Text, Public_Sans } from "next/font/google";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const caslon = Libre_Caslon_Text({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-caslon",
  display: "swap",
});

const publicSans = Public_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Preview-deployer på Vercel ska aldrig indexeras som dubbletter av
// produktionssajten. Endast VERCEL_ENV=production får indexeras.
const isIndexable = !process.env.VERCEL || process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Sockerbagaren — Riktigt fika till jobbet",
    template: "%s — Sockerbagaren",
  },
  description: siteConfig.description,
  robots: isIndexable ? undefined : { index: false, follow: false },
  // Delnings-defaults för alla sidor; sidor med egna openGraph-fält
  // (t.ex. startsida och områdessidor) skriver över titel/beskrivning/url.
  openGraph: {
    siteName: "Sockerbagaren",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Sockerbagaren — riktigt fika till jobbet",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sockerbagaren — Riktigt fika till jobbet",
    description: siteConfig.description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={`${caslon.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
