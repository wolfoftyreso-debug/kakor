"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

// Cloudflare Turnstile-widget (robotskydd). Renderas ENDAST när
// NEXT_PUBLIC_TURNSTILE_SITE_KEY finns — annars returnerar kassan null och
// servern verifierar inget. Explicit rendering så att widgeten kan
// återställas efter ett serverfel (nytt `resetKey`).

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* redan borttagen */
        }
      }
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: "sv",
        theme: "light",
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    };
    if (window.turnstile) mount();
    else window.addEventListener("sb-turnstile-ready", mount, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("sb-turnstile-ready", mount);
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignoreras */
        }
        widgetId.current = null;
      }
    };
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script
        id="turnstile-loader"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => window.dispatchEvent(new Event("sb-turnstile-ready"))}
      />
      <div ref={ref} style={{ minHeight: 65 }} aria-label="Robotkontroll" />
    </>
  );
}
