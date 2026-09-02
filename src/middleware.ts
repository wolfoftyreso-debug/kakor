import { NextRequest, NextResponse } from "next/server";

// Content Security Policy med nonce per request. Next.js läser nonce ur
// CSP-headern på förfrågan och sätter den på sina egna script-taggar;
// egna inline-script (GA4) får nonce via headern "x-nonce".
// Försvar på djupet: en framtida XSS (t.ex. via ett tredjepartsbibliotek)
// ska inte kunna köra script mot admin-sessionen.

const IS_DEV = process.env.NODE_ENV !== "production";
// Vercels förhandsgranskningsverktyg (endast preview-deployer, aldrig produktion).
const IS_VERCEL_PREVIEW = !!process.env.VERCEL && process.env.VERCEL_ENV !== "production";
// Cloudflare Turnstile (robotskydd i kassan) — bara när nyckel finns.
const TURNSTILE = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_HOST = "https://challenges.cloudflare.com";

function buildCsp(nonce: string): string {
  const scriptExtra = [
    "https://www.googletagmanager.com",
    TURNSTILE ? TURNSTILE_HOST : "",
    IS_VERCEL_PREVIEW ? "https://vercel.live" : "",
    IS_DEV ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const connectExtra = [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
    "https://*.ingest.sentry.io",
    "https://*.ingest.de.sentry.io",
    IS_VERCEL_PREVIEW ? "https://vercel.live wss://*.pusher.com https://*.pusher.com" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${scriptExtra}`,
    // React sätter style-attribut inline (style={{…}}) — kräver 'unsafe-inline' för stilar.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com${IS_VERCEL_PREVIEW ? " https://vercel.live https://vercel.com" : ""}`,
    "font-src 'self' data:",
    `connect-src 'self' ${connectExtra}`,
    `frame-src ${[TURNSTILE ? TURNSTILE_HOST : "", IS_VERCEL_PREVIEW ? "https://vercel.live" : ""].filter(Boolean).join(" ") || "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    IS_DEV ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      // Allt utom statiska filer, bilder, ikoner och faktura-PDF:er.
      source:
        "/((?!_next/static|_next/image|images/|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|og.jpg|faktura/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
