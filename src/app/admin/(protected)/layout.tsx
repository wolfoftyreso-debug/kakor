import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { logoutAction } from "@/app/admin/actions";
import { LogoMark } from "@/components/Logo";

// Server-side route-skydd för hela admin. Varje mutation verifierar
// dessutom sessionen igen i sin server action.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  const nav = [
    { href: "/admin", label: "Översikt" },
    { href: "/admin/bestallningar", label: "Beställningar" },
    { href: "/admin/fakturor", label: "Fakturor" },
    { href: "/admin/leveranser", label: "Leveranser" },
    { href: "/admin/prenumerationer", label: "Prenumerationer" },
    { href: "/admin/produkter", label: "Produkter" },
    { href: "/admin/installningar", label: "Inställningar" },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "var(--text)",
          color: "var(--bg)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin"
          style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--bg)", textDecoration: "none" }}
        >
          <LogoMark size={28} inverted />
          <strong style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>
            SOCKERBAGAREN · ADMIN
          </strong>
        </Link>
        <nav
          aria-label="Adminmeny"
          style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: "13.5px", fontWeight: 600 }}
        >
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                color: "var(--footer-text)",
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 6,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--footer-muted)" }}>{admin.email}</span>
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "1px solid var(--footer-muted)",
              color: "var(--footer-text)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Logga ut
          </button>
        </form>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 80px" }}>{children}</main>
    </div>
  );
}
