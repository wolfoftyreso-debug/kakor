import type { Metadata } from "next";
import Link from "next/link";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { SubscriptionFlow } from "./SubscriptionFlow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fikaprenumeration",
  description:
    "Fika som bara dyker upp: välj kakor, mängd och hur ofta — vi levererar på er leveransdag och fakturerar efteråt. Pausa eller avsluta enkelt.",
  alternates: { canonical: "/prenumeration" },
};

export default async function PrenumerationPage() {
  const [products, areas] = await Promise.all([getActiveProducts(), getAreasWithDates(4)]);
  return (
    <>
      <section style={{ background: "var(--section-tint)", padding: "56px 24px", textAlign: "center" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Fikaprenumeration
        </div>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", letterSpacing: "-0.5px", marginBottom: 12 }}>
          Fika som bara dyker upp.
        </h1>
        <p style={{ fontSize: 17, color: "var(--brown-2)", margin: "0 auto", maxWidth: "52ch", lineHeight: 1.6 }}>
          Välj kakor, mängd och hur ofta — så står fikat på plats utan att någon behöver komma ihåg
          det.
        </p>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          <Link href="/bestall" style={{ fontWeight: 600 }}>
            Engångsbeställning istället →
          </Link>
        </p>
      </section>
      <SubscriptionFlow products={products} areas={areas} />
    </>
  );
}
