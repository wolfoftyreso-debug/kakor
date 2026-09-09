"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent } from "./CookieConsent";

function publicPath(pathname: string): string {
  return pathname.replace(/\/prenumeration\/hantera\/[0-9a-f]{16,}/i, "/prenumeration/hantera");
}

export function AnalyticsLoader({ id, nonce }: { id: string; nonce?: string }) {
  const [granted, setGranted] = useState(false);
  const pathname = usePathname();
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

  useEffect(() => {
    if (!granted) return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (!gtag) return;
    const path = publicPath(pathname);
    gtag("event", "page_view", {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    });
  }, [granted, pathname]);

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
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
