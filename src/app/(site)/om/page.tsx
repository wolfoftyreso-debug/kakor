import type { Metadata } from "next";
import Link from "next/link";
import { ImageSlot } from "@/components/ImageSlot";
import { invoiceConfig } from "@/lib/config";
import { InfoPageSeo } from "@/components/InfoPageSeo";

export const metadata: Metadata = {
  title: "Om Sockerbagaren",
  description:
    "Sockerbagaren är ett lokalt bageri i Tyresö som bakar klassiska småkakor på riktiga råvaror och levererar till arbetsplatser i södra Stockholm.",
  alternates: { canonical: "/om" },
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
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 12 }}>Om Sockerbagaren</h1>
      <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Sockerbagaren är ett lokalt bageri på Antennvägen i Tyresö. Vi bakar klassiska svenska
        småkakor — mandelkubb, kolasnittar och chokladsnittar — på riktigt smör, vanligt strösocker
        och kvalitativa traditionella råvaror, och kör själva ut dem till arbetsplatser i södra
        Stockholm.
      </p>
      <div style={{ minHeight: 280, borderRadius: 8, overflow: "hidden", margin: "28px 0" }}>
        <ImageSlot
          label="Chokladsnittar med pärlsocker på ett kakfat"
          src="/images/prenumeration.jpg"
        />
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--brown-2)", maxWidth: "60ch" }}>
        Vi säljer till företag: kontor, verkstäder, byggföretag, kliniker och butiker. Betalningen
        sker alltid mot faktura, och leveransen kommer på fasta leveransdagar per område — Tyresö,
        Nacka, Haninge och Huddinge.
      </p>
      <h2 style={{ fontSize: 22, margin: "32px 0 12px" }}>Kontakt</h2>
      <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--brown-2)" }}>
        {invoiceConfig.companyName}
        <br />
        Org.nr {invoiceConfig.orgNumber}
        <br />
        {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/bestall" className="btn btn-primary">
          Beställ kakor
        </Link>
        <Link href="/prenumeration" className="btn btn-butter">
          Starta fikaprenumeration
        </Link>
      </div>
    </div>
    </>
  );
}
