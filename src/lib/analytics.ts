"use client";

// Tunn eventspårning. Skickar till GA4 om gtag finns (laddas env-gated i
// AnalyticsScript), annars no-op. Får aldrig kasta — analys får inte
// påverka sajtens funktion. Ingen PII skickas i event-parametrar.

type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: string, params: Params = {}): void {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", event, params);
    } else if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, params);
    }
  } catch {
    // medvetet tyst
  }
}

/** Grov klassning av varifrån besökaren kom — ingen URL sparas (ingen PII). */
export function referrerClass(): string {
  try {
    const ref = document.referrer;
    if (!ref) return "none";
    const host = new URL(ref).hostname;
    if (host === window.location.hostname) return "internal";
    if (/(^|\.)google\./.test(host)) return "google";
    if (/(^|\.)bing\./.test(host)) return "bing";
    return "external";
  } catch {
    return "unknown";
  }
}
