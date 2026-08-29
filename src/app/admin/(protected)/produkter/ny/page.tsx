import type { Metadata } from "next";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Admin — ny produkt", robots: { index: false } };

export default function NewProductPage() {
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
          weightOptions: "1,2,3",
          ingredients: "",
          allergens: "",
          imageRef: "",
          sortOrder: 0,
          active: false,
        }}
      />
    </>
  );
}
