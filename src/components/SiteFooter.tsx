import Link from "next/link";
import { LogoSolid } from "@/components/Logo";
import { invoiceConfig } from "@/lib/config";

const AREAS = [
  { slug: "tyreso", name: "Tyresö" },
  { slug: "nacka", name: "Nacka" },
  { slug: "haninge", name: "Haninge" },
  { slug: "huddinge", name: "Huddinge" },
];

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--text)", color: "var(--footer-text)", padding: "56px 0 40px" }}>
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 40,
            paddingBottom: 36,
            borderBottom: "1px solid var(--brown-2)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LogoSolid size={34} />
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--bg)",
                }}
              >
                SOCKERBAGAREN
              </div>
            </div>
            <div style={{ fontSize: "13.5px", lineHeight: 1.7 }}>
              {invoiceConfig.companyName}
              <br />
              Org.nr {invoiceConfig.orgNumber}
              <br />
              {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}
            </div>
          </div>
          <FooterCol
            title="HANDLA"
            links={[
              { href: "/bestall", label: "Beställ kakor" },
              { href: "/prenumeration", label: "Fikaprenumeration" },
              { href: "/#kakor", label: "Våra kakor" },
            ]}
          />
          <FooterCol
            title="LEVERANS"
            links={AREAS.map((a) => ({ href: `/${a.slug}`, label: a.name }))}
          />
          <FooterCol
            title="INFORMATION"
            links={[
              { href: "/ingredienser", label: "Ingredienser & allergener" },
              { href: "/villkor", label: "Leverans- & köpvillkor" },
              { href: "/integritet", label: "Integritetspolicy" },
              { href: "/om", label: "Om Sockerbagaren" },
            ]}
          />
        </div>
        <div style={{ paddingTop: 20, fontSize: "12.5px", color: "var(--footer-muted)" }}>
          © {invoiceConfig.companyName} · Betalning sker mot faktura · Vi levererar under dagen till
          bemannade företagsadresser
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "13.5px" }}>
      <div style={{ fontWeight: 700, color: "var(--bg)", fontSize: 12, letterSpacing: 2 }}>{title}</div>
      {links.map((l) => (
        <Link key={l.href} href={l.href} style={{ color: "var(--footer-text)" }}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
