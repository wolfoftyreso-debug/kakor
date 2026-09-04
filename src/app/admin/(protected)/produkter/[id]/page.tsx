import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductForm } from "../ProductForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — redigera produkt", robots: { index: false } };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  let weightOptions = "1,2,3";
  try {
    const arr = JSON.parse(product.weightOptionsJson);
    if (Array.isArray(arr)) weightOptions = arr.join(",");
  } catch {
    // behåll default
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Redigera {product.name}</h1>
        <Link href={`/admin/produkter/${product.id}/etikett`} style={{ fontSize: 14, fontWeight: 600 }}>
          Etiketter för förpackningen (utskrift)
        </Link>
      </div>
      <ProductForm
        productId={product.id}
        initial={{
          name: product.name,
          slug: product.slug,
          description: product.description,
          priceKr: (product.pricePerKgOre / 100).toString(),
          unit: product.unit,
          packageWeightGrams: product.packageWeightGrams,
          weightOptions,
          ingredients: product.ingredients,
          allergens: product.allergens,
          imageRef: product.imageRef,
          vatRateBp: product.vatRateBp,
          badge: product.badge,
          piecesPerKgApprox: product.piecesPerKgApprox == null ? "" : String(product.piecesPerKgApprox),
          sortOrder: product.sortOrder,
          active: product.active,
        }}
      />
    </>
  );
}
