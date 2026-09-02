"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Samtyckesbanner för statistikcookies (GA4). Renderas bara när GA är
// konfigurerat (prop från servern). Utan uttryckligt "Tillåt" laddas
// inget Google-script — se AnalyticsScript. Valet sparas per webbläsare.

export const CONSENT_KEY = "sb_consent_v1";
export const CONSENT_EVENT = "sb-consent-changed";
export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent | null) {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, value);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* privat läge etc. */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setOpen(readConsent() === null);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  if (!open) return null;
  return (
    <div className="consent" role="region" aria-label="Cookies">
      <p className="consent-text">
        Vi vill använda Google Analytics för anonym besöksstatistik. Inga cookies för statistik
        sätts förrän ni godkänner. Beställningen fungerar oavsett val.{" "}
        <Link href="/integritet">Läs mer</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => writeConsent("denied")}>
          Avböj
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => writeConsent("granted")}>
          Tillåt statistik
        </button>
      </div>
    </div>
  );
}

/** Länk på integritetssidan för att ändra sitt val. */
export function ConsentReset() {
  const [current, setCurrent] = useState<Consent | null>(null);
  useEffect(() => {
    const sync = () => setCurrent(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  return (
    <p style={{ margin: "10px 0 0", fontSize: 14 }}>
      Ert val just nu: <strong>{current === "granted" ? "statistik tillåten" : current === "denied" ? "statistik avböjd" : "inget val gjort"}</strong>.{" "}
      <button type="button" className="link-button" onClick={() => writeConsent(null)}>
        Ändra val
      </button>
    </p>
  );
}
