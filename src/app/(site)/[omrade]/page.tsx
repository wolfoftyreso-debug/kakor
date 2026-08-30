import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AREA_CONTENT } from "@/lib/area-content";
import { sharePreview } from "@/lib/seo/meta";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { ImageSlot } from "@/components/ImageSlot";
import { fromISODate, weekdayName, formatDeliveryDate } from "@/lib/dates";
import { invoiceConfig } from "@/lib/config";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { breadcrumbNode, faqNode, graph, webPageNode } from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ omrade: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { omrade } = await params;
  const content = AREA_CONTENT[omrade];
  if (!content) return {};
  return {
    title: content.title,
    description: content.metaDescription,
    alternates: { canonical: `/${content.slug}` },
    ...sharePreview({
      title: content.title,
      description: content.metaDescription,
      path: `/${content.slug}`,
    }),
  };
}

export default async function AreaPage({ params }: Props) {
  const { omrade } = await params;
  const content = AREA_CONTENT[omrade];
  if (!content) notFound();

  const [products, areas] = await Promise.all([getActiveProducts(), getAreasWithDates(2)]);
  const area = areas.find((a) => a.slug === content.slug);
  const nextDate = area?.upcomingDates[0] ? fromISODate(area.upcomingDates[0]) : null;
  const weekdayLabel = area
    ? [...new Set(area.weekdays)].map(weekdayName).join(" och ")
    : null;

  const path = `/${content.slug}`;
  const crumbs = [
    { name: "Sockerbagaren", path: "/" },
    { name: content.name, path },
  ];

  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title: content.title, description: content.metaDescription, breadcrumbs: crumbs }),
          breadcrumbNode(path, crumbs),
          // Exakt samma frågor/svar som renderas synligt längre ner på sidan.
          faqNode(path, content.faqs)
        )}
      />
      <Breadcrumbs crumbs={crumbs} />

      <section
        className="container-medium two-col"
        style={{ padding: "32px 24px 48px", display: "grid", gap: 40, alignItems: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="eyebrow">Leveransområde · {content.name}</div>
          <h1 style={{ fontSize: "clamp(30px, 4.5vw, 42px)", lineHeight: 1.12, letterSpacing: "-0.5px" }}>
            {content.heroHeading}
          </h1>
          <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, color: "var(--brown-2)" }}>
            {content.heroText}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <Link href="/bestall" className="btn btn-primary" style={{ padding: "15px 26px" }}>
              Beställ till {content.name}
            </Link>
            <Link href="/prenumeration" className="btn btn-butter" style={{ padding: "15px 26px" }}>
              Fikaprenumeration
            </Link>
          </div>
        </div>
        <div style={{ minHeight: 280, borderRadius: 8, overflow: "hidden" }}>
          <ImageSlot
            label="Skål med mandelkubb bredvid en kopp kaffe"
            src="/images/hero.jpg"
            priority
          />
        </div>
      </section>

      <section style={{ background: "var(--section-tint)", padding: "48px 0" }}>
        <div
          className="container-medium"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}
        >
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Leveransdag i {content.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--red)",
                textTransform: "capitalize",
              }}
            >
              {weekdayLabel ?? "—"}
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
              {nextDate ? (
                <>
                  Nästa tillgängliga leverans:{" "}
                  <strong style={{ textTransform: "capitalize" }}>{formatDeliveryDate(nextDate)}</strong>.
                </>
              ) : (
                "Tillgängliga dagar visas i checkouten."
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Så levererar vi</div>
            <div style={{ fontSize: "13.5px", color: "var(--brown-2)", lineHeight: 1.65 }}>
              Under dagen, till bemannade företagsadresser. Se till att någon kan ta emot leveransen
              — reception, personalrum eller lastkaj.
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Betalning</div>
            <div style={{ fontSize: "13.5px", color: "var(--brown-2)", lineHeight: 1.65 }}>
              Alltid mot faktura. Ni beställer, vi levererar, fakturan kommer efteråt. Inga kort,
              inga konton.
            </div>
          </div>
        </div>
      </section>

      <section className="container-medium" style={{ padding: "56px 24px" }}>
        <h2 style={{ fontSize: "clamp(24px, 3vw, 30px)", marginBottom: 24 }}>
          Kakorna vi levererar i {content.name}
        </h2>
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
        <div style={{ marginTop: 20 }}>
          <Link href="/bestall" style={{ fontWeight: 700, fontSize: 15 }}>
            Se vikter och beställ →
          </Link>
        </div>
      </section>

      <section style={{ background: "var(--butter)", padding: "48px 0" }}>
        <div
          className="container-medium two-col"
          style={{ display: "grid", gap: 40, alignItems: "center" }}
        >
          <div>
            <h2 style={{ fontSize: "clamp(22px, 3vw, 28px)", marginBottom: 10 }}>{content.midHeading}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0, color: "var(--brown-2)" }}>{content.midText}</p>
          </div>
          <div style={{ minHeight: 220, borderRadius: 8, overflow: "hidden" }}>
            <ImageSlot label="Kolasnittar på ett fat bredvid en kopp kaffe" src="/images/fika.jpg" />
          </div>
        </div>
      </section>

      <section className="container-narrow" style={{ padding: "56px 24px" }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 28px)", marginBottom: 20 }}>
          Vanliga frågor — {content.name}
        </h2>
        <div>
          {content.faqs.map((f) => (
            <div key={f.q} style={{ borderBottom: "1px solid var(--border)", padding: "16px 4px" }}>
              <div style={{ fontSize: "15.5px", fontWeight: 700 }}>{f.q}</div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--brown-2)", marginTop: 6, maxWidth: "65ch" }}>
                {f.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--text)", color: "var(--bg)", padding: "56px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", marginBottom: 18 }}>
          Ska vi ordna nästa fika i {content.name}?
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
