import { headers } from "next/headers";
import { AnalyticsLoader } from "./AnalyticsLoader";
import { CookieConsent } from "./CookieConsent";

// GA4 — laddas ENDAST om NEXT_PUBLIC_GA4_ID är satt och ser ut som ett
// riktigt mät-ID (G-XXXXXXX) OCH besökaren gett samtycke i bannern.
// Inline-scriptet får CSP-nonce från proxyn (src/proxy.ts); utan nonce blockeras det.
const GA_ID_PATTERN = /^G-[A-Z0-9]{6,14}$/;

export async function AnalyticsScript() {
  const id = process.env.NEXT_PUBLIC_GA4_ID;
  if (!id || !GA_ID_PATTERN.test(id)) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <CookieConsent />
      <AnalyticsLoader id={id} nonce={nonce} />
    </>
  );
}
