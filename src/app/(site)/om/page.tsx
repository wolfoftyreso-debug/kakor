import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import Link from "next/link";
import { ImageSlot } from "@/components/ImageSlot";
import { invoiceConfig, isVerifiedValue } from "@/lib/config";
import { InfoPageSeo } from "@/components/InfoPageSeo";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: { absolute: "Om Sockerbagaren — småkakor på recept från 1957" },
  description:
    "Sockerbagaren bakar klassiska svenska småkakor på riktiga råvaror och levererar till arbetsplatser i södra Stockholm. Betalning mot faktura.",
  alternates: { canonical: "/om" },
  ...sharePreview({
    title: "Om Sockerbagaren",
    description:
      "Sockerbagaren bakar klassiska svenska småkakor på riktiga råvaror och levererar till arbetsplatser i södra Stockholm. Betalning mot faktura.",
    path: "/om",
    image: { url: "/images/bakning.jpg", alt: "Chokladsnittar läggs upp på plåt" },
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
    <div className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
      <PageHeader
        eyebrow="Om oss"
        title="Om Sockerbagaren"
        lede="Sockerbagaren bakar klassiska svenska småkakor — mandelkubb, kolasnittar och chokladsnittar — på riktigt smör, vanligt strösocker och kvalitativa traditionella råvaror, och levererar dem till arbetsplatser i södra Stockholm."
        facts={[
          { label: "Recept", value: "Svenskt konditorlexikon 1957" },
          { label: "Kunder", value: "Företag i södra Stockholm" },
          { label: "Betalning", value: "Alltid mot faktura" },
          { label: "Kontor", value: `${invoiceConfig.address}, ${invoiceConfig.city}` },
        ]}
      />
      <figure>
        <div className="media">
          <ImageSlot label="Chokladsnittar läggs upp på plåt" src="/images/bakning.jpg" />
        </div>
        <figcaption>Chokladsnittar på plåt — sortimentet bakas i omgångar och levereras från lagret i Tyresö.</figcaption>
      </figure>
      <p>
        Vi säljer till företag: kontor, verkstäder, byggföretag, kliniker och butiker. Betalningen
        sker alltid mot faktura, och leveransen kommer på fasta leveransdagar per område — Tyresö,
        Nacka, Haninge och Huddinge.
      </p>
      <h2>Recept från 1957</h2>
      <p>
        Våra recept kommer från Svenskt konditorlexikon från 1957 — den tidens handbok för
        yrkeskonditorer. Det betyder gammaldags småkakor så som de bakades innan margarin och
        tillsatser blev standard: smör, socker, vetemjöl, ägg, mandel, choklad och sirap. Kakorna
        bakas i omgångar och levereras från lagret på Radiovägen i Tyresö.
      </p>
      <h2>Så beställer ni</h2>
      <p>
        Välj sorter och mängd per kilo (eller prova-på-paketet på 1,5 kg), välj leveransdag för ert
        område och ange faktureringsuppgifter — fakturan skapas direkt och förfaller först efter
        leveransen. Återkommande fika? <Link href="/prenumeration">Fikaprenumerationen</Link> gör
        om samma beställning automatiskt. Läs mer i vår{" "}
        <Link href="/fika-till-jobbet">guide till fika på jobbet</Link>.
      </p>
      <h2>Företagsuppgifter</h2>
      <p style={{ lineHeight: 1.8 }}>
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
      <div className="actions">
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
