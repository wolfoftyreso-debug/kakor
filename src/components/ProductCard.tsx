"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { ImageSlot } from "@/components/ImageSlot";
import { formatOre } from "@/lib/money";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricePerKgOre: number;
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <Heading style={{ fontSize: 21 }}>
            <Link href={`/kakor/${product.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
              {product.name}
            </Link>
          </Heading>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--text-2)", whiteSpace: "nowrap" }}>
            {formatOre(product.pricePerKgOre)}/kg{" "}
            <span style={{ fontSize: 11.5, fontFamily: "var(--font-sans)" }}>exkl. moms</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)", lineHeight: 1.5, flex: 1 }}>
          {product.description}
        </p>
        <div style={{ display: "flex", gap: 8 }} role="group" aria-label={`Välj vikt för ${product.name}`}>
          {product.weightOptions.map((w) => (
            <button
              key={w}
              type="button"
              className={`weight-btn${kg === w ? " selected" : ""}`}
              aria-pressed={kg === w}
              onClick={() => setSelectedKg(w)}
            >
              {w} kg
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
