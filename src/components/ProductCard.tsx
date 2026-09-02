"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart, MAX_UNITS } from "@/lib/cart";
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
  /** Kort etikett från admin, t.ex. "Bästsäljare". Tom sträng = ingen. */
  badge: string;
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
    <article className="card product-card">
      <Link
        href={`/kakor/${product.slug}`}
        className="card-media"
        aria-label={`${product.name} — läs mer`}
        tabIndex={-1}
      >
        <ImageSlot label={`${product.name} — närbild`} src={product.imageRef || undefined} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
      </Link>
      <div className="product-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "4px 12px", flexWrap: "wrap" }}>
          <Heading className="product-title">
            <Link href={`/kakor/${product.slug}`}>{product.name}</Link>
          </Heading>
          {/* Priset följer valt antal — á-priset visas som hint när fler än en valts. */}
          <div className="product-price">
            <span>
              {formatOre(kg * product.pricePerKgOre)}
              {kg === 1 ? priceSuffix(product.unit) : ""}
            </span>
            <small>
              {kg > 1 ? `(${formatOre(product.pricePerKgOre)}${priceSuffix(product.unit)}) ` : ""}
              exkl. moms
            </small>
          </div>
        </div>
        <p className="product-desc">{product.description}</p>
        {/* Allergener ovanför knapparna: då hamnar stepper + "Lägg i korgen"
            alltid på samma höjd i alla kort oavsett textlängd. */}
        <div className="product-meta">
          {product.allergens} <Link href="/ingredienser">Alla ingredienser</Link>
        </div>
        <div className="product-actions">
          {/* Fritt antal — riktig stepper i stället för fasta förval. */}
          <div
            className="stepper"
            role="group"
            aria-label={`Välj ${product.unit === "paket" ? "antal" : "vikt"} för ${product.name}`}
          >
            <button
              type="button"
              aria-label={`Minska ${product.name}`}
              disabled={kg <= 1}
              onClick={() => setSelectedKg(Math.max(1, kg - 1))}
            >
              −
            </button>
            <div className="stepper-value" aria-live="polite">
              {qtyLabel(kg, product.unit)}
            </div>
            <button
              type="button"
              aria-label={`Öka ${product.name}`}
              disabled={kg >= MAX_UNITS}
              onClick={() => setSelectedKg(Math.min(MAX_UNITS, kg + 1))}
            >
              +
            </button>
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
        </div>
      </div>
    </article>
  );
}
