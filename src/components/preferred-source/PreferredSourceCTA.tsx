"use client";

// =====================================================================
// GOOGLE PREFERRED SOURCES — officiell implementation.
//
// Använder Googles officiella knapp (publisher.js + [google-add-preferred-
// source-btn]) och den officiella deeplinken till källinställningarna som
// script-fri reservväg. Ingen egen "Google-knapp" ritas, ingen bekräftelse
// simuleras och inget "Google rekommenderar oss" påstås.
//
// Aktiveras ENDAST när NEXT_PUBLIC_PREFERRED_SOURCES=true — staging- och
// utvecklingsmiljöer visar ingenting (ingen domänläcka).
//
// Visas efter levererat värde (orderbekräftelse, prenumerationsbekräftelse)
// — aldrig som popup på landningssidor.
//
// Mätning: preferred_source_impression + preferred_source_click.
// KLICK ≠ BEKRÄFTELSE — någon "confirmed"-händelse skickas inte eftersom
// Googles bekräftelse inte kan observeras tillförlitligt från sidan.
// =====================================================================

import Script from "next/script";
import { useEffect, useRef } from "react";
import { referrerClass, track } from "@/lib/analytics";

export type PreferredSourcePlacement =
  | "result_success"
  | "subscription_success"
  | "article_end"
  | "footer";

const ENABLED = process.env.NEXT_PUBLIC_PREFERRED_SOURCES === "true";

function deeplink(): string {
  // Domännivå (kravet från Google) — kataloger stöds inte.
  const domain = typeof window !== "undefined" ? window.location.hostname : "";
  return `https://www.google.com/preferences/source?q=${encodeURIComponent(domain)}`;
}

export function PreferredSourceCTA({ placement }: { placement: PreferredSourcePlacement }) {
  const seen = useRef(false);

  useEffect(() => {
    if (!ENABLED || seen.current) return;
    seen.current = true;
    track("preferred_source_impression", {
      placement,
      pathname: window.location.pathname,
      locale: "sv",
      referrer_class: referrerClass(),
    });
  }, [placement]);

  if (!ENABLED) return null;

  return (
    <div
      className="card"
      style={{
        marginTop: 24,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* Officiellt script — next/script deduplicerar via id, laddas lazy så
          att det aldrig påverkar LCP. Om Google fallerar renderas ingen knapp
          och sidan fortsätter fungera; deeplinken nedan finns alltid. */}
      <Script
        id="google-preferred-sources"
        src="https://news.google.com/swg/js/v1/publisher.js"
        strategy="lazyOnload"
      />
      <div style={{ fontWeight: 700, fontSize: 15 }}>
        Vill ni se mer från Sockerbagaren i era Google-sökningar?
      </div>
      <div style={{ fontSize: "13.5px", color: "var(--text-2)", maxWidth: "44ch" }}>
        Lägg till Sockerbagaren som föredragen källa på Google så visas våra sidor oftare i era
        sökresultat.
      </div>
      <div
        onClickCapture={() =>
          track("preferred_source_click", {
            placement,
            pathname: window.location.pathname,
            locale: "sv",
          })
        }
      >
        <div {...{ "google-add-preferred-source-btn": "" }} data-lang="sv" />
      </div>
      <a
        href={deeplink()}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: "12.5px" }}
        onClick={() => track("preferred_source_click", { placement, variant: "deeplink" })}
      >
        eller öppna Googles källinställningar
      </a>
    </div>
  );
}
