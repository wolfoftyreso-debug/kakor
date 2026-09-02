import { ConsentReset } from "@/components/CookieConsent";
import type { Metadata } from "next";
import { sharePreview } from "@/lib/seo/meta";
import { invoiceConfig, isVerifiedValue } from "@/lib/config";
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
const CONTENT_UPDATED = "2026-09-02";

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
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Personuppgiftsansvarig</h2>
          <p style={{ margin: 0 }}>
            {invoiceConfig.companyName}, org.nr {invoiceConfig.orgNumber},{" "}
            {invoiceConfig.address}, {invoiceConfig.postalCode} {invoiceConfig.city}.
            {isVerifiedValue(invoiceConfig.email) ? (
              <>
                {" "}E-post: <a href={`mailto:${invoiceConfig.email}`}>{invoiceConfig.email}</a>.
              </>
            ) : null}
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Vilka uppgifter vi behandlar och varför</h2>
          <p style={{ margin: 0 }}>
            När ni beställer behandlar vi företagsuppgifter samt kontaktpersonens namn, e-post och
            telefon, leverans- och faktureringsuppgifter. Rättslig grund: fullgörande av avtal för
            att leverera och fakturera; rättslig förpliktelse (bokföringslagen) för order- och
            fakturaunderlag; berättigat intresse för kontaktpersoners uppgifter, för skydd mot
            missbruk (tillfälliga, IP-baserade begränsningar) och för felsökning. Vi säljer aldrig
            uppgifter vidare och använder dem inte för marknadsföring.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Hur länge uppgifterna sparas</h2>
          <p style={{ margin: 0 }}>
            Order- och fakturauppgifter sparas i sju år efter utgången av det räkenskapsår de avser
            (bokföringslagen). Loggar över skickad e-post raderas efter 90 dagar och tekniska
            begränsningsräknare inom ett dygn. Varukorg och pågående beställning lagras endast i er
            webbläsare tills beställningen skickas.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Mottagare och överföring</h2>
          <p style={{ margin: 0 }}>
            Vi använder personuppgiftsbiträden för driften: Vercel Inc. (webbhotell, servrar i EU),
            Neon Inc. (databas i EU), Resend Inc. (e-postutskick) och Functional Software Inc.
            (Sentry, felövervakning i EU). Bolagen är amerikanska; i den mån uppgifter överförs
            utanför EU/EES sker det med stöd av EU–US Data Privacy Framework eller EU-kommissionens
            standardavtalsklausuler.
          </p>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Cookies och lokal lagring</h2>
          <p style={{ margin: 0 }}>
            {process.env.NEXT_PUBLIC_GA4_ID
              ? "Webbplatsen kan använda Google Analytics 4 för anonym besöksstatistik — men bara om ni godkänner det i bannern. Utan samtycke laddas inget Google-script och inga statistikcookies sätts. "
              : "Webbplatsen använder inga spårnings- eller marknadsföringscookies. "}
            Varukorgen och ert cookieval lagras i webbläsarens lokala lagring och en nödvändig
            sessionskaka används enbart för administratörens inloggning — ingen av dessa kräver
            samtycke.
          </p>
          {process.env.NEXT_PUBLIC_GA4_ID ? <ConsentReset /> : null}
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Era rättigheter</h2>
          <p style={{ margin: 0 }}>
            Ni har rätt till tillgång, rättelse, radering (i den mån bokföringslagen tillåter),
            begränsning, dataportabilitet och att invända mot behandling som stöds på berättigat
            intresse.{" "}
            {isVerifiedValue(invoiceConfig.email) ? (
              <>
                Mejla <a href={`mailto:${invoiceConfig.email}`}>{invoiceConfig.email}</a> så hjälper vi er.
              </>
            ) : (
              "Svara på er orderbekräftelse så hjälper vi er."
            )}{" "}
            Ni kan också klaga hos Integritetsskyddsmyndigheten (imy.se).
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
