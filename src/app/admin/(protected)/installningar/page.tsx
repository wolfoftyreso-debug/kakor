import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { invoiceConfig, emailConfig, siteConfig } from "@/lib/config";
import { AreaForm } from "./AreaForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — inställningar", robots: { index: false } };

export default async function SettingsPage() {
  const areas = await prisma.deliveryArea.findMany({ orderBy: { sortOrder: "asc" } });

  const companyRows: [string, string][] = [
    ["Juridiskt namn", invoiceConfig.companyName],
    ["Organisationsnummer", invoiceConfig.orgNumber],
    ["Adress", `${invoiceConfig.address}, ${invoiceConfig.postalCode} ${invoiceConfig.city}`],
    ["Faktura-e-post", invoiceConfig.email],
    ["Telefon", invoiceConfig.phone],
    ["Bankgiro", invoiceConfig.bankgiro],
    ["Momsreg.nr", invoiceConfig.vatNumber],
    ["Betalningsvillkor", `${invoiceConfig.paymentTermsDays} dagar`],
    ["E-postavsändare", emailConfig.from],
    ["E-postleverantör", emailConfig.provider],
    ["Sajt-URL", siteConfig.url],
  ];

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Inställningar</h1>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 19, marginBottom: 8 }}>Leveransdagar per område</h2>
        <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 16px", maxWidth: "70ch" }}>
          Veckodagar anges 1–7 (1 = måndag … 7 = söndag). Framförhållning = antal hela dagar mellan
          beställning och tidigast valbara leveransdag. Postnummerprefix (frivilligt) spärrar
          beställningar med postnummer utanför området.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {areas.map((a) => (
            <AreaForm
              key={a.id}
              areaId={a.id}
              name={a.name}
              weekdays={safeJoin(a.weekdaysJson)}
              leadTimeDays={a.leadTimeDays}
              postalPrefixes={safeJoin(a.postalCodePrefixesJson)}
              active={a.active}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 19, marginBottom: 8 }}>Företags- och fakturauppgifter</h2>
        <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 16px", maxWidth: "70ch" }}>
          Dessa värden styrs av environment variables (se <code>.env.example</code>) och kräver
          omstart/omdeploy vid ändring. Värden markerade{" "}
          <strong>[EJ VERIFIERAT]</strong> måste fyllas i av verksamheten innan skarpa fakturor
          skickas — de hamnar på fakturan precis som de står här.
        </p>
        <div className="card" style={{ padding: "8px 20px", maxWidth: 640 }}>
          {companyRows.map(([label, value]) => (
            <div key={label} className="divider-row" style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", fontSize: 14 }}>
              <span style={{ color: "var(--text-2)" }}>{label}</span>
              <span
                style={{
                  fontWeight: 600,
                  textAlign: "right",
                  color: value.includes("EJ VERIFIERAT") ? "var(--red)" : "var(--text)",
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function safeJoin(json: string): string {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join(",") : "";
  } catch {
    return "";
  }
}
