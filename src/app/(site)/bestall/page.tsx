import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { CheckoutFlow } from "./CheckoutFlow";
import { JsonLd } from "@/components/JsonLd";
import { graph, webPageNode } from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beställ kakor",
  description:
    "Snabbeställning för företag: välj kakor per kilo eller paket, leveransdag och betala mot faktura. Lokal leverans i Tyresö, Nacka, Haninge och Huddinge.",
  alternates: { canonical: "/bestall" },
  ...sharePreview({
    title: "Beställ kakor",
    description:
      "Snabbeställning för företag: välj kakor per kilo eller paket, leveransdag och betala mot faktura. Lokal leverans i Tyresö, Nacka, Haninge och Huddinge.",
    path: "/bestall",
  }),
};

export default async function BestallPage() {
  const [products, areas] = await Promise.all([getActiveProducts(), getAreasWithDates(4)]);
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path: "/bestall",
            title: "Beställ kakor",
            description: String(metadata.description),
          })
        )}
      />
      <CheckoutFlow products={products} areas={areas} />
    </>
  );
}
