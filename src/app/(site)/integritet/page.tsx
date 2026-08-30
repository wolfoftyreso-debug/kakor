import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { invoiceConfig } from "@/lib/config";
import { InfoPageSeo } from "@/components/InfoPageSeo";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description: "Hur Sockerbagaren behandlar personuppgifter i samband med beställningar.",
  alternates: { canonical: "/integritet" },
  ...sharePreview({
    title: "Integritetspolicy",
    description:
      "Hur Sockerbagaren behandlar personuppgifter i samband med beställningar.",
    path: "/integritet",
  }),
};

// Senast innehållsändrad — uppdateras manuellt vid verklig policyändring.
const CONTENT_UPDATED = "2026-08-29";

export default function IntegritetPage() {
  return (
    <>
    <InfoPageSeo
      path="/integritet"
      name="Integritetspolicy"
      title="Integritetspolicy"
      description={String(metadata.description)}
      dateModified={CONTENT_UPDATED}
    />
    <div className="container-narrow" style={{ padding: "24px 24px 80px" }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginBottom: 20 }}>Integritetspolicy</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 20px" }}>
        Uppdaterad {CONTENT_UPDATED}
      </p>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--brown-2)", maxWidth: "65ch", display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Vilka uppgifter vi samlar in</h2>
          <p style={{ margin: 0 }}>
            När ni beställer sparar vi de uppgifter som behövs för att hantera ordern: företagsnamn,
            organisationsnummer, kontaktperson, e-post, telefon, leveransadress och
            faktureringsuppgifter. Vi säljer inte uppgifterna vidare och använder dem inte för
            annat än att hantera er beställning, leverans och fakturering.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Hur länge uppgifterna sparas</h2>
          <p style={{ margin: 0 }}>
            Order- och fakturauppgifter sparas så länge bokföringslagen kräver. Varukorgen sparas
            endast lokalt i er webbläsare tills beställningen skickas.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Cookies</h2>
          <p style={{ margin: 0 }}>
            Webbplatsen använder inga spårnings- eller marknadsföringscookies. Varukorgen lagras i
            webbläsarens lokala lagring, och en sessionskaka används enbart för administratörens
            inloggning.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Personuppgiftsansvarig</h2>
          <p style={{ margin: 0 }}>
            {invoiceConfig.companyName}, org.nr {invoiceConfig.orgNumber},{" "}
            {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}. Kontakta oss
            om ni vill få era uppgifter rättade eller raderade (i den mån lagkrav tillåter).
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
