import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";
import { LogoSigill } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Admin — logga in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const admin = await getAdmin();
  if (admin) redirect("/admin");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 380, maxWidth: "100%", padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <LogoSigill size={92} />
          <h1 style={{ fontSize: 22, marginTop: 12 }}>Sockerbagaren Admin</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "6px 0 0" }}>
            Endast för verksamhetens administratörer.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
