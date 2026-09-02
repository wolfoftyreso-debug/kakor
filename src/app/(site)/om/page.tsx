import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { ImageSlot } from "@/components/ImageSlot";
import { invoiceConfig, isVerifiedValue } from "@/lib/config";
import { InfoPageSeo } from "@/components/InfoPageSeo";

export const metadata: Metadata = {
  title: "Om Sockerbagaren",
  description:
    "Sockerbagaren bakar klassiska svenska småkakor på riktiga råvaror och levererar till arbetsplatser i södra Stockholm. Betalning mot faktura.",
  alternates: { canonical: "/om" },
  ...sharePreview({
    title: "Om Sockerbagaren",
    description:
      "Sockerbagaren bakar klassiska svenska småkakor på riktiga råvaror och levererar till arbetsplatser i södra Stockholm. Betalning mot faktura.",
    path: "/om",
  }),
};

export default function OmPage() {
  return (
    <>
    <InfoPageSeo
      path="/om"
      name="Om Sockerbagaren"
      title="Om Sockerbagaren"
      description={String(metadata.description)}
    />
    <div className="container-narrow" style={{ padding: "24px 24px 80px" }}>
      <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)", marginBottom: 14 }}>Om Sockerbagaren</h1>
      <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Sockerbagaren bakar klassiska svenska småkakor — mandelkubb, kolasnittar och
        chokladsnittar — på riktigt smör, vanligt strösocker och kvalitativa traditionella
        råvaror, och kör själva ut dem till arbetsplatser i södra Stockholm.
      </p>
      <div style={{ minHeight: 280, borderRadius: 8, overflow: "hidden", margin: "28px 0" }}>
        <ImageSlot
          label="Chokladsnittar läggs upp på plåt"
          src="/images/bakning.jpg"
        />
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Vi säljer till företag: kontor, verkstäder, byggföretag, kliniker och butiker. Betalningen
        sker alltid mot faktura, och leveransen kommer på fasta leveransdagar per område — Tyresö,
        Nacka, Haninge och Huddinge.
      </p>
      <h2 style={{ fontSize: 22, margin: "32px 0 12px" }}>Företagsuppgifter</h2>
      <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--brown-2)" }}>
        {invoiceConfig.companyName}
        <br />
        Org.nr {invoiceConfig.orgNumber}
        <br />
        Kontor: {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}
        <br />
        Lager: Radiovägen 19, Tyresö (c/o Mewab)
        {/* Kontaktvägar visas när verksamheten verifierat dem — platshållare
            renderas aldrig publikt. */}
        {isVerifiedValue(invoiceConfig.email) && (
          <>
            <br />
            <a href={`mailto:${invoiceConfig.email}`}>{invoiceConfig.email}</a>
          </>
        )}
        {isVerifiedValue(invoiceConfig.phone) && (
          <>
            <br />
            <a href={`tel:${invoiceConfig.phone.replace(/[^\d+]/g, "")}`}>{invoiceConfig.phone}</a>
          </>
        )}
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/bestall" className="btn btn-primary">
          Beställ kakor
        </Link>
        <Link href="/bestall?typ=aterkommande" className="btn btn-butter">
          Starta fikaprenumeration
        </Link>
      </div>
    </div>
    </>
  );
}
