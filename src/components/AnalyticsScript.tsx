import Script from "next/script";
import { headers } from "next/headers";

// GA4 — laddas ENDAST om NEXT_PUBLIC_GA4_ID är satt och ser ut som ett
// riktigt mät-ID (G-XXXXXXX). Efter interaktivitet (påverkar inte LCP),
// IP-anonymisering och inga annonssignaler. Inline-scriptet får CSP-nonce
// från middlewaren; utan nonce blockeras det av policyn.
const GA_ID_PATTERN = /^G-[A-Z0-9]{6,14}$/;

export async function AnalyticsScript() {
  const id = process.env.NEXT_PUBLIC_GA4_ID;
  if (!id || !GA_ID_PATTERN.test(id)) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <Script
        id="ga4-loader"
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" nonce={nonce} strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(id)}, {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
