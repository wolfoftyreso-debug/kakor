"use client";

// Köpbox på produktsidan: antal + lägg i korgen + gå till beställning.
// Priset här är endast visning — servern räknar alltid om vid beställning.
// På mobil följer en kompakt köpbar med i botten när själva boxen scrollat
// ur bild, så att "Lägg i korgen" alltid är ett tumtryck bort.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart, MAX_UNITS } from "@/lib/cart";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import type { ProductCardData } from "@/components/ProductCard";

export function ProductBuyBox({ product, deliveryDays }: { product: ProductCardData; deliveryDays?: string }) {
  const { addKg } = useCart();
  const [kg, setKg] = useState(product.weightOptions[0] ?? 1);
  const [stickyVisible, setStickyVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // Baren visas först när boxen lämnat viewporten uppåt — inte när
        // sidan laddas med boxen synlig (ingen dubblerad CTA).
        setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const add = () =>
    addKg(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        pricePerKgOre: product.pricePerKgOre,
        unit: product.unit,
      },
      kg
    );
  const total = formatOre(kg * product.pricePerKgOre);

  return (
    <>
      <div ref={boxRef} className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <span className="section-label">BESTÄLL</span>
          {/* Priset följer valt antal — á-priset visas som hint när fler än en valts. */}
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700 }}>
            {total}
            {kg === 1 ? priceSuffix(product.unit) : ""}{" "}
            <span style={{ fontSize: 12, fontWeight: 400, fontFamily: "var(--font-sans)", color: "var(--text-2)" }}>
              {kg > 1
                ? `(${formatOre(product.pricePerKgOre)}${priceSuffix(product.unit)}) exkl. moms`
                : "exkl. moms"}
            </span>
          </span>
        </div>
        {/* Fritt antal — riktig stepper i stället för fasta förval. */}
        <div
          className="stepper"
          role="group"
          aria-label={`Välj ${product.unit === "paket" ? "antal" : "vikt"} för ${product.name}`}
        >
          <button type="button" aria-label={`Minska ${product.name}`} disabled={kg <= 1} onClick={() => setKg(Math.max(1, kg - 1))}>
            −
          </button>
          <div className="stepper-value" aria-live="polite">
            {qtyLabel(kg, product.unit)}
          </div>
          <button type="button" aria-label={`Öka ${product.name}`} disabled={kg >= MAX_UNITS} onClick={() => setKg(Math.min(MAX_UNITS, kg + 1))}>
            +
          </button>
        </div>
        <button type="button" className="btn btn-primary" style={{ padding: 15 }} onClick={add}>
          {/* Knappen bär det uträknade priset — kunden ser vad valet kostar innan klicket. */}
          Lägg i korgen · {total}
        </button>
        <Link href="/bestall" className="btn btn-butter" style={{ padding: 14, textAlign: "center" }}>
          Till beställningen
        </Link>
        <div style={{ fontSize: "12.5px", color: "var(--text-2)", lineHeight: 1.5 }}>
          Betalning mot faktura · Leverans{deliveryDays ? ` ${deliveryDays}` : " på fasta leveransdagar"} i
          Tyresö, Nacka, Haninge och Huddinge
        </div>
      </div>

      {/* Mobil: sticky köpbar (CSS visar den bara ≤ 860 px). */}
      <div className={`sticky-buy${stickyVisible ? " visible" : ""}`} aria-hidden={!stickyVisible}>
        <div style={{ minWidth: 0 }}>
          <div className="sticky-buy-name">{product.name}</div>
          <div className="sticky-buy-price">
            {qtyLabel(kg, product.unit)} · {total} exkl. moms
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: "12px 18px", fontSize: 14, whiteSpace: "nowrap" }}
          tabIndex={stickyVisible ? 0 : -1}
          onClick={add}
        >
          Lägg i korgen
        </button>
      </div>
    </>
  );
}
