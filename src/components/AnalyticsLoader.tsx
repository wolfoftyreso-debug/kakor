"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent } from "./CookieConsent";

// Laddar gtag först efter samtycke. Vid återkallat samtycke avaktiveras
// mätningen (window['ga-disable-<id>']) — scriptet kan inte laddas ur, men
// skickar inget mer.
export function AnalyticsLoader({ id, nonce }: { id: string; nonce?: string }) {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    const sync = () => {
      const g = readConsent() === "granted";
      setGranted((prev) => prev || g);
      (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = !g;
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [id]);
  if (!granted) return null;
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
