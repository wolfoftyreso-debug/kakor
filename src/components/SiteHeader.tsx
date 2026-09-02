"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoSigill } from "@/components/Logo";
import { useCart } from "@/lib/cart";

const NAV = [
  { href: "/kakor", label: "Kakor" },
  { href: "/prenumeration", label: "Fikaprenumeration" },
  { href: "/leverans", label: "Leverans" },
  { href: "/om", label: "Om Sockerbagaren" },
];

// Aktiv menypunkt: exakt träff eller undersida (t.ex. /kakor/kolasnittar → Kakor).
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const { totalKg } = useCart();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Headern överlever klientnavigering — menyn ska inte ligga kvar över
  // nästa sida efter klick på Beställ/Korg/logotyp. Escape stänger också.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    // Klick/tryck utanför headern stänger menyn (overlay-mönster).
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Fokus tillbaka till knappen som öppnade menyn (WAI-ARIA-mönster).
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <>
      <a href="#innehall" className="skip-link">
        Hoppa till innehåll
      </a>
      <div className="top-banner" role="region" aria-label="Leveransområden och betalning">
        {/* Lång text på desktop, kort på mobil — samma fakta, inga radbrytningar. */}
        <span className="banner-long">
          Vi levererar företagsfika i <strong>Tyresö, Nacka, Haninge och Huddinge</strong> — betalning
          mot faktura.
        </span>
        <span className="banner-short">
          Företagsfika i södra Stockholm · <strong>Betalning mot faktura</strong>
        </span>
      </div>
      <header
        ref={headerRef}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 48px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          gap: 16,
          position: "relative",
        }}
        className="site-header"
      >
        <Link
          href="/"
          className="logo-link"
          aria-label="Sockerbagaren – till startsidan"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)" }}
        >
          <LogoSigill size={88} />
          <span
            className="logo-word"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            SOCKERBAGAREN
          </span>
        </Link>

        <nav
          aria-label="Huvudmeny"
          className="site-nav"
          style={{ display: "flex", gap: 28, fontSize: "14.5px", fontWeight: 600 }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              style={{ color: "var(--text)", textDecoration: "none" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/bestall" className="btn btn-primary" style={{ padding: "11px 22px", fontSize: 14 }}>
            Beställ
          </Link>
          <Link
            href="/bestall"
            className="cart-link"
            style={{
              // Inline-badge bredvid texten — aldrig absolut positionerad,
              // så den kan varken täcka bokstäverna eller grannelementen.
              display: "inline-flex",
              alignItems: "flex-start",
              gap: 3,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
            aria-label={`Varukorg (${totalKg})`}
          >
            Korg
            <span
              style={{
                background: "var(--butter)",
                borderRadius: 999,
                fontSize: "10.5px",
                fontWeight: 700,
                lineHeight: 1,
                padding: "3px 6px",
                marginTop: -5,
              }}
            >
              {totalKg}
            </span>
          </Link>
          <button
            ref={toggleRef}
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobilmeny"
            aria-label={open ? "Stäng meny" : "Öppna meny"}
            onClick={() => setOpen((o) => !o)}
            style={{
              display: "none",
              flexDirection: "column",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <span style={{ width: 22, height: 2, background: "var(--text)" }} />
            <span style={{ width: 22, height: 2, background: "var(--text)" }} />
            <span style={{ width: 22, height: 2, background: "var(--text)" }} />
          </button>
        </div>

        {open && (
          <nav
            id="mobilmeny"
            aria-label="Mobilmeny"
            className="mobile-nav"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--bg)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              padding: "8px 20px 16px",
              zIndex: 50,
            }}
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                style={{
                  color: "var(--text)",
                  textDecoration: "none",
                  fontWeight: 600,
                  padding: "14px 0",
                  borderBottom: "1px solid var(--divider)",
                }}
              >
                {item.label}
              </Link>
            ))}
            {/* Menyn slutar i handling (mönster: lululemon/Etsy-drawers) —
                primär CTA + korgen, inte bara länkar. */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Link href="/bestall" className="btn btn-primary" style={{ flex: 1, textAlign: "center", padding: 14 }} onClick={() => setOpen(false)}>
                Beställ kakor
              </Link>
              <Link href="/bestall" className="btn btn-outline" style={{ padding: "14px 18px" }} onClick={() => setOpen(false)}>
                Korg ({totalKg})
              </Link>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 12 }}>
              Betalning mot faktura · Tyresö, Nacka, Haninge och Huddinge
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
