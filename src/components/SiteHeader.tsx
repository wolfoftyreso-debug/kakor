"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoSigill } from "@/components/Logo";
import { useCart } from "@/lib/cart";

const NAV = [
  { href: "/kakor", label: "Kakor" },
  { href: "/prenumeration", label: "Fikaprenumeration" },
  { href: "/leverans", label: "Leverans" },
  { href: "/om", label: "Om Sockerbagaren" },
];

export function SiteHeader() {
  const { totalKg } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <a href="#innehall" className="skip-link">
        Hoppa till innehåll
      </a>
      <div
        style={{
          background: "var(--text)",
          color: "var(--bg)",
          textAlign: "center",
          padding: "9px 16px",
          fontSize: "13.5px",
        }}
      >
        Vi levererar företagsfika i <strong>Tyresö, Nacka, Haninge och Huddinge</strong> — betalning
        mot faktura.
      </div>
      <header
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
            <Link key={item.href} href={item.href} style={{ color: "var(--text)", textDecoration: "none" }}>
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
            className="menu-toggle"
            aria-expanded={open}
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
            aria-label="Mobilmeny"
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
                style={{
                  color: "var(--text)",
                  textDecoration: "none",
                  fontWeight: 600,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--divider)",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
