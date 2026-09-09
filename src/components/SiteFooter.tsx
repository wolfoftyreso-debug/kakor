import Link from "next/link";
import { LogoSigill } from "@/components/Logo";
import { invoiceConfig, isVerifiedValue } from "@/lib/config";
import { getDeliveryDaysLabel } from "@/lib/products";

const AREAS = [
  { slug: "tyreso", name: "Tyresö" },
  { slug: "nacka", name: "Nacka" },
  { slug: "haninge", name: "Haninge" },
  { slug: "huddinge", name: "Huddinge" },
];

export async function SiteFooter() {
  const deliveryDays = await getDeliveryDaysLabel();
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
              <LogoSigill size={40} />
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
              Sockerbagaren drivs av {invoiceConfig.companyName}
              <br />
              Org.nr {invoiceConfig.orgNumber}
              <br />
              {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}
              {/* Visas först när verksamheten verifierat uppgifterna. */}
              {isVerifiedValue(invoiceConfig.email) && (
                <>
                  <br />
                  <a href={`mailto:${invoiceConfig.email}`} style={{ color: "var(--footer-text)" }}>
                    {invoiceConfig.email}
                  </a>
                </>
              )}
              {isVerifiedValue(invoiceConfig.phone) && (
                <>
                  <br />
                  <a
                    href={`tel:${invoiceConfig.phone.replace(/[^\d+]/g, "")}`}
                    style={{ color: "var(--footer-text)" }}
                  >
                    {invoiceConfig.phone}
                  </a>
                </>
              )}
            </div>
          </div>
          <FooterCol
            title="HANDLA"
            links={[
              { href: "/bestall", label: "Beställ kakor" },
              { href: "/prenumeration", label: "Fikaprenumeration" },
              { href: "/kakor", label: "Våra kakor" },
            ]}
          />
          <FooterCol
            title="LEVERANS"
            links={[{ href: "/leverans", label: "Så levererar vi" }, ...AREAS.map((a) => ({ href: `/${a.slug}`, label: a.name }))]}
          />
          <FooterCol
            title="INFORMATION"
            links={[
              { href: "/fika-till-jobbet", label: "Guide: fika till jobbet" },
              { href: "/julfika", label: "Julfika på jobbet" },
              { href: "/folkets-kaka", label: "Folkets nästa småkaka" },
              { href: "/ingredienser", label: "Ingredienser och allergener" },
              { href: "/villkor", label: "Leverans- och köpvillkor" },
              { href: "/integritet", label: "Integritetspolicy" },
              { href: "/om", label: "Om Sockerbagaren" },
            ]}
          />
        </div>
        <div style={{ paddingTop: 20, fontSize: "12.5px", color: "var(--footer-muted)" }}>
          © {invoiceConfig.companyName} · Betalning sker mot faktura · Leverans{deliveryDays ? ` ${deliveryDays}` : ""} i södra Stockholm
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div style={{ fontSize: "13.5px" }}>
      <h2 style={{ fontWeight: 700, color: "var(--bg)", fontSize: 12, letterSpacing: 2, margin: "0 0 10px", fontFamily: "inherit" }}>{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="footer-link">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
