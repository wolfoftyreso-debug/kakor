import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/FaqList";
import { notFound } from "next/navigation";
import { AREA_CONTENT } from "@/lib/area-content";
import { sharePreview } from "@/lib/seo/meta";
import { getActiveProducts, getAreasWithDates } from "@/lib/products";
import { ImageSlot } from "@/components/ImageSlot";
import { fromISODate, weekdayName, formatDeliveryDate, capitalizeFirst, listSv } from "@/lib/dates";
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
  const content = Object.hasOwn(AREA_CONTENT, omrade) ? AREA_CONTENT[omrade] : undefined;
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
  // Object.hasOwn: /constructor och /toString ska ge 404, inte en trasig sida.
  const content = Object.hasOwn(AREA_CONTENT, omrade) ? AREA_CONTENT[omrade] : undefined;
  if (!content) notFound();

  const [products, areas] = await Promise.all([getActiveProducts(), getAreasWithDates(2)]);
  const area = areas.find((a) => a.slug === content.slug);
  const nextDate = area?.upcomingDates[0] ? fromISODate(area.upcomingDates[0]) : null;
  const weekdayLabel = area
    ? listSv([...new Set(area.weekdays)].map(weekdayName))
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
          <h1 className="h-display" style={{ fontSize: "clamp(32px, 4.5vw, 46px)" }}>
            {content.heroHeading}
          </h1>
          <p style={{ fontSize: "16.5px", lineHeight: 1.65, margin: 0, color: "var(--brown-2)" }}>
            {content.heroText}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <Link href="/bestall" className="btn btn-primary" style={{ padding: "15px 26px" }}>
              Beställ till {content.name}
            </Link>
            <Link href="/bestall?typ=aterkommande" className="btn btn-butter" style={{ padding: "15px 26px" }}>
              Starta fikaprenumeration
            </Link>
          </div>
        </div>
        <div style={{ minHeight: 280, borderRadius: 8, overflow: "hidden" }}>
          <ImageSlot
            label="Fat med chokladsnittar, mandelkubb och kolasnittar bredvid en kopp kaffe"
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
            <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, fontFamily: "inherit" }}>
              Leveransdag i {content.name}
            </h2>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--red)",
              }}
            >
              {weekdayLabel ? capitalizeFirst(weekdayLabel) : "–"}
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
              {nextDate ? (
                <>
                  Nästa tillgängliga leverans:{" "}
                  <strong>{formatDeliveryDate(nextDate)}</strong>.
                </>
              ) : (
                "Tillgängliga dagar visas i kassan."
              )}
              {area && area.leadTimeDays > 0 && (
                <>
                  {" "}
                  Beställ senast {area.leadTimeDays} {area.leadTimeDays === 1 ? "dag" : "dagar"} före leveransdagen.
                </>
              )}
            </div>
          </div>
          {/* Postnumren är områdets egna (admin) – det som faktiskt skiljer sidorna åt. */}
          {area && area.postalPrefixes.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, fontFamily: "inherit" }}>
                Postnummer i {content.name}
              </h2>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700 }}>
                {area.postalPrefixes.map((pfx) => `${pfx}xx`).join(", ")}
              </div>
              <div style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
                Företagsadresser med de här postnummerserierna. Kassan bekräftar postnumret innan ni beställer.
              </div>
            </div>
          )}
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, fontFamily: "inherit" }}>Faktura, inget annat</h2>
            <div style={{ fontSize: "13.5px", color: "var(--brown-2)", lineHeight: 1.65 }}>
              Fakturan mejlas när ni beställer, {invoiceConfig.paymentTermsDays} dagars betalningsvillkor från leveransen.{" "}
              <Link href="/leverans">Så går leveransen till</Link> · <Link href="/villkor">villkor</Link>.
            </div>
          </div>
        </div>
      </section>

      <section className="container-medium" style={{ padding: "56px 24px" }}>
        <h2 className="h-sub" style={{ marginBottom: 12 }}>
          Kakorna vi levererar i {content.name}
        </h2>
        <p style={{ margin: "0 0 18px", color: "var(--brown-2)", maxWidth: "60ch", lineHeight: 1.6 }}>
          Samma sortiment till alla arbetsplatser i {content.name} – sorterna blandas fritt i en och samma beställning.
          Hela beskrivningen, ingredienserna och priset finns på varje sorts egen sida.
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 12 }}>
          {products.map((p) => (
            <li key={p.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span className="review-thumb" aria-hidden="true">
                <ImageSlot label="" src={p.imageRef || undefined} decorative sizes="44px" />
              </span>
              <span>
                <Link href={`/kakor/${p.slug}`} style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
                  {p.name}
                </Link>
                {p.badge && <span className="pill pill-new" style={{ marginLeft: 8 }}>{p.badge}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 20, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/kakor" className="section-link">
            Alla kakor med priser →
          </Link>
          <Link href="/bestall" className="section-link">
            Beställ till {content.name} →
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
            <p style={{ fontSize: 14.5, margin: "12px 0 0" }}>
              <Link href="/fika-till-jobbet" style={{ fontWeight: 600 }}>
                Guide: hur mycket fika behöver ni per person? →
              </Link>
            </p>
          </div>
          <div style={{ minHeight: 220, maxHeight: 380, borderRadius: 8, overflow: "hidden" }}>
            <ImageSlot
              label="Kartong med kakor lastas för leverans"
              src="/images/leverans.jpg"
            />
          </div>
        </div>
      </section>

      <section className="container-narrow" style={{ padding: "56px 24px" }}>
        <FaqList heading={`Vanliga frågor – ${content.name}`} items={content.faqs} />
        {content.moreLink && (
          <div style={{ marginTop: 18, fontSize: "14.5px" }}>
            <Link href={content.moreLink.href} style={{ fontWeight: 700 }}>
              {content.moreLink.label} →
            </Link>
          </div>
        )}
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
