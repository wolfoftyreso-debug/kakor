"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { ImageSlot } from "@/components/ImageSlot";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricePerKgOre: number; // á-pris per enhet (kg eller paket)
  unit: string; // "kg" | "paket"
  packageWeightGrams: number; // 0 för lösvikt
  weightOptions: number[];
  allergens: string;
  imageRef: string;
}

export function ProductCard({
  product,
  headingLevel = "h3",
}: {
  product: ProductCardData;
  /** h2 där kortet ligger direkt under sidans h1 (t.ex. /kakor). */
  headingLevel?: "h2" | "h3";
}) {
  const { addKg } = useCart();
  const [kg, setSelectedKg] = useState(product.weightOptions[0] ?? 1);
  const Heading = headingLevel;

  return (
    <div
      className="card"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ height: 220 }}>
        <ImageSlot label={`${product.name} — närbild`} src={product.imageRef || undefined} />
      </div>
      <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <Heading style={{ fontSize: 21 }}>
            <Link href={`/kakor/${product.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
              {product.name}
            </Link>
          </Heading>
          {/* Priset följer valt antal — á-priset visas som hint när fler än en valts. */}
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--text-2)", whiteSpace: "nowrap" }}>
            {formatOre(kg * product.pricePerKgOre)}
            {kg === 1 ? priceSuffix(product.unit) : ""}{" "}
            {kg > 1 && (
              <span style={{ fontSize: 11.5, fontFamily: "var(--font-sans)" }}>
                ({formatOre(product.pricePerKgOre)}
                {priceSuffix(product.unit)}){" "}
              </span>
            )}
            <span style={{ fontSize: 11.5, fontFamily: "var(--font-sans)" }}>exkl. moms</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)", lineHeight: 1.5, flex: 1 }}>
          {product.description}
        </p>
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
              onClick={() => setSelectedKg(w)}
            >
              {qtyLabel(w, product.unit)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: 14, fontSize: "14.5px" }}
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
          Lägg i korgen
        </button>
        <div style={{ fontSize: "11.5px", color: "var(--text-2)" }}>
          {product.allergens} <Link href="/ingredienser">Alla ingredienser</Link>
        </div>
      </div>
    </div>
  );
}
