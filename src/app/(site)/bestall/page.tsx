import type { Metadata } from "next";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { CheckoutFlow } from "./CheckoutFlow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beställ kakor",
  description:
    "Snabbeställning för företag: välj kakor per kilo, leveransdag och betala mot faktura. Lokal leverans i Tyresö, Nacka, Haninge och Huddinge.",
  alternates: { canonical: "/bestall" },
};

export default async function BestallPage() {
  const [products, areas] = await Promise.all([getActiveProducts(), getAreasWithDates(4)]);
  return <CheckoutFlow products={products} areas={areas} />;
}
