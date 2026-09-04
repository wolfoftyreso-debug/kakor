"use client";

import { useEffect } from "react";

// Design 2.0: varsam infasning av sektioner när de rullas in. Innehållet är
// synligt utan JS (klassen "js" sätts först här), och animeringen stängs av
// helt vid prefers-reduced-motion (se globals.css).
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("js");
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px", threshold: 0 }
    );
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      // Det som redan syns vid sidladdning ska aldrig fasas in — bara det nedanför.
      if (r.top < window.innerHeight) el.classList.add("in");
      else io.observe(el);
    });
    // Säkerhetsnät: inget får förbli osynligt (snabb hoppscroll, ankarlänk, udda IO-beteende).
    const failsafe = window.setTimeout(() => els.forEach((el) => el.classList.add("in")), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);
  return null;
}
