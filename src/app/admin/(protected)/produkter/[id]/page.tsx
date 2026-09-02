import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
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
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Redigera {product.name}</h1>
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
          badge: product.badge,
          sortOrder: product.sortOrder,
          active: product.active,
        }}
      />
    </>
  );
}
