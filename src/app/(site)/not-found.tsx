import type { Metadata } from "next";
import Link from "next/link";
import { LogoSigill } from "@/components/Logo";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "96px 24px" }}>
      <LogoSigill size={110} />
      <h1 style={{ fontSize: 32, margin: "20px 0 10px" }}>Sidan hittades inte</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 28 }}>
        Kanske är ni sugna på kakor i stället?
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/kakor" className="btn btn-outline btn-lg">
          Se kakorna
        </Link>
        <Link href="/bestall" className="btn btn-primary btn-lg">
          Beställ
        </Link>
      </div>
      <p style={{ marginTop: 18, fontSize: 14 }}>
        <Link href="/">Till startsidan</Link>
      </p>
    </div>
  );
}
