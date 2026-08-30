import type { Metadata } from "next";
import Link from "next/link";
import { sharePreview } from "@/lib/seo/meta";
import { getActiveProducts } from "@/lib/products";
import { ImageSlot } from "@/components/ImageSlot";
import { invoiceConfig } from "@/lib/config";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";

// Lokal landningssida för bageri-sökningar i Tyresö (Semrush se-databasen:
// "bageri tyresö" 590 sök/mån KD17, "bageri trollbäcken" 720 KD20).
// Allt innehåll är verifierbart: adressen, sortimentet, leveransmodellen.

export const dynamic = "force-dynamic";

const TITLE = "Bageri i Tyresö";
const DESCRIPTION =
  "Sockerbagaren är ett lokalt bageri på Antennvägen i Tyresö. Vi bakar klassiska svenska småkakor på riktigt smör och levererar per kilo till arbetsplatser i Tyresö — från Trollbäcken till Tyresö strand — och grannkommunerna. Betalning mot faktura.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/bageri-tyreso" },
  ...sharePreview({ title: TITLE, description: DESCRIPTION, path: "/bageri-tyreso" }),
};

const FAQS = [
  {
    q: "Var i Tyresö ligger bageriet?",
    a: "På Antennvägen 2 i Tyresö. Beställningar görs online och levereras ut till arbetsplatser — vi kör själva.",
  },
  {
    q: "Levererar ni till Trollbäcken?",
    a: "Ja — vi levererar i hela Tyresö kommun: Trollbäcken, Bollmora, Tyresö strand, Lindalen och övriga områden med företagsadresser.",
  },
  {
    q: "Vad bakar ni?",
    a: "Tre klassiska svenska småkakor: mandelkubb, kolasnittar och chokladsnittar — bakade på riktigt smör och riktiga råvaror, sålda per kilo.",
  },
  {
    q: "Hur beställer man?",
    a: "Online på sockerbagaren.se. Vi säljer till företag, leveransen kommer på områdets fasta leveransdag och betalningen sker alltid mot faktura i efterhand.",
  },
];

export default async function BageriTyresoPage() {
  const products = await getActiveProducts();
  const path = "/bageri-tyreso";
  const crumbs = [
    { name: "Sockerbagaren", path: "/" },
    { name: "Bageri i Tyresö", path },
  ];

  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title: TITLE, description: DESCRIPTION, breadcrumbs: crumbs }),
          breadcrumbNode(path, crumbs),
          // Samma frågor/svar som renderas synligt nedan.
          faqNode(path, FAQS)
        )}
      />
      <Breadcrumbs crumbs={crumbs} />

      <section
        className="container-medium two-col"
        style={{ padding: "32px 24px 48px", display: "grid", gap: 40, alignItems: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="eyebrow">Antennvägen 2 · Tyresö</div>
          <h1 style={{ fontSize: "clamp(30px, 4.5vw, 42px)", lineHeight: 1.12, letterSpacing: "-0.5px" }}>
            Bageri i Tyresö — klassiska småkakor på riktigt smör
          </h1>
          <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, color: "var(--brown-2)" }}>
            Sockerbagaren är ett lokalt bageri i Tyresö. Vi bakar svenska klassiker — mandelkubb,
            kolasnittar och chokladsnittar — och säljer dem per kilo till arbetsplatser. Beställ
            online, så kör vi själva ut i hela kommunen och grannkommunerna. Betalning mot faktura.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <Link href="/bestall" className="btn btn-primary" style={{ padding: "15px 26px" }}>
              Beställ kakor
            </Link>
            <Link href="/kakor" className="btn btn-butter" style={{ padding: "15px 26px" }}>
              Se sortimentet
            </Link>
          </div>
        </div>
        <div style={{ minHeight: 280, borderRadius: 8, overflow: "hidden" }}>
          <ImageSlot label="Fat med chokladsnittar, mandelkubb och kolasnittar bredvid en kopp kaffe" src="/images/hero.jpg" priority />
        </div>
      </section>

      <section style={{ background: "var(--section-tint)", padding: "48px 0" }}>
        <div
          className="container-medium"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}
        >
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Lokalt i Tyresö</div>
            <div style={{ fontSize: "13.5px", color: "var(--brown-2)", lineHeight: 1.65 }}>
              Bageriet ligger på Antennvägen 2. Leveransen till Tyresö kommer alltså från
              grannskapet — Trollbäcken, Bollmora, Tyresö strand, Lindalen och övriga kommundelar.
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Per kilo, till företag</div>
            <div style={{ fontSize: "13.5px", color: "var(--brown-2)", lineHeight: 1.65 }}>
              Vi säljer kakorna per kilo till kontor, verkstäder, butiker och kliniker — blanda
              sorter fritt i samma order. Fasta leveransdagar per område.
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Betalning mot faktura</div>
            <div style={{ fontSize: "13.5px", color: "var(--brown-2)", lineHeight: 1.65 }}>
              Inga kort och inga konton — ni beställer, vi levererar, fakturan kommer efteråt med{" "}
              {invoiceConfig.paymentTermsDays} dagars betalningsvillkor.
            </div>
          </div>
        </div>
      </section>

      <section className="container-medium" style={{ padding: "56px 24px" }}>
        <h2 style={{ fontSize: "clamp(24px, 3vw, 30px)", marginBottom: 24 }}>Kakorna vi bakar</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/kakor/${p.slug}`}
              className="card"
              style={{ overflow: "hidden", textDecoration: "none", color: "var(--text)" }}
            >
              <div style={{ height: 170 }}>
                <ImageSlot label={`${p.name} — närbild`} src={p.imageRef || undefined} />
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}>
                  {p.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-medium" style={{ padding: "0 24px 56px" }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 28px)", marginBottom: 8 }}>Vanliga frågor</h2>
        <div>
          {FAQS.map((f) => (
            <div key={f.q} style={{ borderBottom: "1px solid var(--border)", padding: "16px 4px" }}>
              <div style={{ fontSize: "15.5px", fontWeight: 700 }}>{f.q}</div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--brown-2)", marginTop: 6, maxWidth: "65ch" }}>
                {f.a}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, fontSize: "14.5px", color: "var(--text-2)" }}>
          Söker du fika till arbetsplatsen i närområdet? Vi levererar även i{" "}
          <Link href="/nacka">Nacka</Link>, <Link href="/haninge">Haninge</Link> och{" "}
          <Link href="/huddinge">Huddinge</Link> — eller läs mer om{" "}
          <Link href="/tyreso">företagsfika i Tyresö</Link>.
        </div>
      </section>

      <section style={{ background: "var(--text)", color: "var(--bg)", padding: "56px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", marginBottom: 18 }}>
          Fika från ett bageri i Tyresö — direkt till er arbetsplats
        </h2>
        <Link href="/bestall" className="btn btn-butter btn-lg">
          Beställ kakor
        </Link>
        <div style={{ marginTop: 32, fontSize: "12.5px", color: "var(--footer-muted)" }}>
          {invoiceConfig.companyName} · Org.nr {invoiceConfig.orgNumber} · {invoiceConfig.address},{" "}
          {invoiceConfig.postalCode} {invoiceConfig.city}
        </div>
      </section>
    </>
  );
}
