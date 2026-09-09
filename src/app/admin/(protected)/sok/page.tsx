import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/guard";
import { CRAWLER_POLICY } from "@/lib/seo/crawlers";
import { computeSeoStatus, readSeoStatusInput, seoSummary, type SeoLevel } from "@/lib/seo/status";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin – sök och synlighet", robots: { index: false } };

const PILL: Record<SeoLevel, string> = {
  GREEN: "pill-ok",
  WARNING: "pill-new",
  CRITICAL: "pill-warn",
  UNKNOWN: "pill-unknown",
};

const LABEL: Record<SeoLevel, string> = {
  GREEN: "GREEN",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN",
};

export default async function SeoStatusPage() {
  await requireAdminPage();
  const checks = computeSeoStatus(readSeoStatusInput());
  const summary = seoSummary(checks);
  const sitemapUrl = `${siteConfig.url.replace(/\/$/, "")}/sitemap.xml`;
  const robotsUrl = `${siteConfig.url.replace(/\/$/, "")}/robots.txt`;

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Sök och synlighet</h1>
      <p style={{ color: "var(--text-2)", fontSize: 14.5, marginBottom: 20, maxWidth: "70ch" }}>
        Status från koden och miljövariablerna. UNKNOWN betyder att vi inte kan veta – inte att
        allt är i sin ordning. Inga sökdata låtsas fram.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {(
          [
            ["GREEN", summary.green],
            ["WARNING", summary.warning],
            ["CRITICAL", summary.critical],
            ["UNKNOWN", summary.unknown],
          ] as const
        ).map(([level, n]) => (
          <div key={level} className="card" style={{ padding: "14px 16px" }}>
            <div className="section-label">{level}</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 700 }}>{n}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
        {checks.map((c) => (
          <section key={c.id} className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 17, margin: 0 }}>{c.label}</h2>
              <span className={`pill ${PILL[c.level]}`}>{LABEL[c.level]}</span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6 }}>{c.detail}</p>
            {c.action && (
              <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
                <strong>Nästa steg:</strong> {c.action}
              </p>
            )}
          </section>
        ))}
      </div>

      <section className="card" style={{ padding: "20px 22px", marginBottom: 28 }}>
        <h2 style={{ fontSize: 19, margin: "0 0 12px" }}>Manuella steg (kan inte göras i koden)</h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, lineHeight: 1.7 }}>
          <li>
            Koppla <strong>sockerbagaren.se</strong> i Vercel och sätt{" "}
            <code>SITE_URL=https://sockerbagaren.se</code>. Gör det sist.
          </li>
          <li>
            <strong>Google Search Console:</strong> lägg till URL-prefix-egenskapen{" "}
            <code>https://sockerbagaren.se</code>. Välj verifiering med HTML-tagg. Klistra in
            content-värdet i Vercel som <code>NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION</code>. Deploya.
            Bekräfta i GSC. Skicka in <code>{sitemapUrl}</code>.
          </li>
          <li>
            <strong>Bing Webmaster Tools:</strong> samma egenskap. HTML-metatagg{" "}
            <code>msvalidate.01</code> sätts i <code>NEXT_PUBLIC_BING_SITE_VERIFICATION</code>.
            Skicka in samma sitemap.
          </li>
          <li>
            <strong>Google Business Profile:</strong> leveransverksamhet utan besöksadress, kategori
            Bagerigrossist, serviceområden Tyresö, Nacka, Haninge och Huddinge. Enda publika
            adressen är Antennvägen 2, Tyresö. Profil-URL i <code>NEXT_PUBLIC_SAME_AS</code>.
          </li>
          <li>
            Sätt <code>NEXT_PUBLIC_GA4_ID</code> om organiska ordrar ska mätas. Eventen{" "}
            <code>order_completed</code> bär då <code>source_class</code> och{" "}
            <code>landing_cluster</code> (branded / local / product / subscription / info).
          </li>
        </ol>
        <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--text-2)" }}>
          robots.txt: <Link href="/robots.txt">{robotsUrl}</Link>
          {" · "}
          sitemap: <Link href="/sitemap.xml">{sitemapUrl}</Link>
          {" · "}
          llms.txt: <Link href="/llms.txt">/llms.txt</Link>
        </p>
      </section>

      <section className="card" style={{ padding: "20px 22px" }}>
        <h2 style={{ fontSize: 19, margin: "0 0 8px" }}>Crawlers</h2>
        <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 14px" }}>
          Sökindexering och modellträning är inte samma sak. Träningsbotar är tillåtna via * tills
          ni uttryckligen vill stänga av dem.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Crawler</th>
                <th>Grupp</th>
                <th>Policy</th>
                <th>Varför</th>
              </tr>
            </thead>
            <tbody>
              {CRAWLER_POLICY.map((row) => (
                <tr key={row.crawler}>
                  <td>{row.crawler}</td>
                  <td>{row.group}</td>
                  <td>{row.policy}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
