"use client";

// Köpbox på produktsidan: viktval + lägg i korgen + gå till beställning.
// Priset här är endast visning — servern räknar alltid om vid beställning.

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import type { ProductCardData } from "@/components/ProductCard";

export function ProductBuyBox({ product }: { product: ProductCardData }) {
  const { addKg } = useCart();
  const [kg, setKg] = useState(product.weightOptions[0] ?? 1);

  return (
    <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span className="section-label">BESTÄLL</span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700 }}>
          {formatOre(product.pricePerKgOre)}
          {priceSuffix(product.unit)}{" "}
          <span style={{ fontSize: 12, fontWeight: 400, fontFamily: "var(--font-sans)", color: "var(--text-2)" }}>
            exkl. moms
          </span>
        </span>
      </div>
      <div
        style={{ display: "flex", gap: 8 }}
        role="group"
        aria-label={`Välj ${product.unit === "paket" ? "antal" : "vikt"} för ${product.name}`}
      >
        {product.weightOptions.map((w) => (
          <button
            key={w}
            type="button"
            className={`weight-btn${kg === w ? " selected" : ""}`}
            aria-pressed={kg === w}
            onClick={() => setKg(w)}
          >
            {qtyLabel(w, product.unit)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ padding: 15 }}
        onClick={() =>
          addKg(
            {
              productId: product.id,
              slug: product.slug,
              name: product.name,
              pricePerKgOre: product.pricePerKgOre,
              unit: product.unit,
            },
            kg
          )
        }
      >
        {/* Knappen bär det uträknade priset — kunden ser vad valet kostar innan klicket. */}
        Lägg i korgen · {formatOre(kg * product.pricePerKgOre)}
      </button>
      <Link href="/bestall" className="btn btn-butter" style={{ padding: 14, textAlign: "center" }}>
        Till beställningen
      </Link>
      <div style={{ fontSize: "12.5px", color: "var(--text-2)", lineHeight: 1.5 }}>
        Betalning mot faktura · Leverans på fasta leveransdagar i Tyresö, Nacka, Haninge och
        Huddinge
      </div>
    </div>
  );
}
