import * as Sentry from "@sentry/nextjs";
import { describeError } from "@/lib/log";

// Cloudflare Turnstile — robotskydd i kassan. Helt env-styrt: utan nycklar
// renderas ingen widget och inget verifieras (sajten fungerar som förut).
// Med nycklar krävs en giltig token för att skapa order/prenumeration.
// Testnycklar från Cloudflare ("1x0000…AA") passerar alltid — bra i preview.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SECRET_KEY = process.env.TURNSTILE_SECRET_KEY ?? "";

export function turnstileEnabled(): boolean {
  return SITE_KEY.length > 0 && SECRET_KEY.length > 0;
}

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

/**
 * Verifierar en token mot Cloudflare. Nätverksfel mot Cloudflare släpper
 * igenom (loggas + Sentry) — ett driftfel hos tredje part ska inte stoppa
 * beställningar; rate limiting och missbruksspärrarna finns kvar som skydd.
 * Ett uttryckligt "success: false" avvisas alltid.
 */
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<TurnstileResult> {
  if (!turnstileEnabled()) return { ok: true };
  if (!token) return { ok: false, reason: "missing-input-response" };
  const body = new URLSearchParams({ secret: SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`siteverify svarade ${res.status}`);
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
  } catch (e) {
    console.error("[turnstile] verifiering kunde inte nå Cloudflare — släpper igenom:", describeError(e));
    Sentry.captureException(e, { tags: { flow: "turnstile" } });
    return { ok: true };
  }
}

/** Klientens IP ur Vercels/proxyns header (första hoppet). */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || null;
}
