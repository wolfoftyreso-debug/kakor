import type { NextRequest } from "next/server";

// Anonym besökskaka: en slumpad identitet utan koppling till person. Behövs
// för regeln "en röst per besökare och omgång" – ingen fingerprinting, inget
// mer än så. Nödvändig för funktionen, kräver inget samtycke.
export const VISITOR_COOKIE = "sb_besok";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 dagar – webbläsarnas tak

const SERVES_HTTPS = !!process.env.VERCEL || (process.env.SITE_URL ?? "").startsWith("https://");

export function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: SERVES_HTTPS,
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE,
  };
}

export function readVisitorId(req: NextRequest): string | undefined {
  const v = req.cookies.get(VISITOR_COOKIE)?.value;
  return v && /^[a-f0-9]{32}$/.test(v) ? v : undefined;
}

/** Same-origin-krav: formulär och skript på andra domäner ska inte kunna rösta åt besökaren. */
export function sameOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}