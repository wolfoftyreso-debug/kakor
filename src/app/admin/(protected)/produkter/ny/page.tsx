import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Admin — ny produkt", robots: { index: false } };

export default async function NewProductPage() {
  await requireAdminPage();
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Ny produkt</h1>
      <ProductForm
        productId={null}
        initial={{
          name: "",
          slug: "",
          description: "",
          priceKr: "",
          unit: "kg",
          packageWeightGrams: 0,
          weightOptions: "1,2,3",
          ingredients: "",
          allergens: "",
          imageRef: "",
          vatRateBp: 1200,
          badge: "",
          sortOrder: 0,
          active: false,
        }}
      />
    </>
  );
}
