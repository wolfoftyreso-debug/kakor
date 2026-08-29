import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "96px 24px" }}>
      <LogoMark size={64} />
      <h1 style={{ fontSize: 32, margin: "20px 0 10px" }}>Sidan hittades inte</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 28 }}>
        Kanske är du sugen på kakor istället?
      </p>
      <Link href="/" className="btn btn-primary btn-lg">
        Till startsidan
      </Link>
    </div>
  );
}
