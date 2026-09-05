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
    <div className="container-narrow prose" style={{ padding: "16px 24px 80px" }}>
      <h1 className="h-display page-title">Integritetspolicy</h1>
      <p className="meta">
        Uppdaterad {CONTENT_UPDATED}
      </p>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--brown-2)", maxWidth: "65ch", display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <h2>Personuppgiftsansvarig</h2>
          <p>
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
          <h2>Vilka uppgifter vi behandlar och varför</h2>
          <p>
            När ni beställer behandlar vi företagsuppgifter samt kontaktpersonens namn, e-post och
            telefon, leverans- och faktureringsuppgifter. Rättslig grund: fullgörande av avtal för
            att leverera och fakturera; rättslig förpliktelse (bokföringslagen) för order- och
            fakturaunderlag; berättigat intresse för kontaktpersoners uppgifter, för skydd mot
            missbruk (tillfälliga, IP-baserade begränsningar) och för felsökning. Vi säljer aldrig
            uppgifter vidare och använder dem inte för marknadsföring.
          </p>
        </section>
        <section>
          <h2>Hur länge uppgifterna sparas</h2>
          <p>
            Order- och fakturauppgifter sparas i sju år efter utgången av det räkenskapsår de avser
            (bokföringslagen). Loggar över skickad e-post raderas efter 90 dagar och tekniska
            begränsningsräknare inom ett dygn. Varukorg och pågående beställning lagras endast i er
            webbläsare tills beställningen skickas.
          </p>
        </section>
        <section>
          <h2>Mottagare och överföring</h2>
          <p>
            Vi använder personuppgiftsbiträden för driften: Vercel Inc. (webbhotell, servrar i
            Frankfurt), Neon Inc. (databas), Resend Inc. (e-postutskick) och Functional Software
            Inc. (Sentry, felövervakning). När robotskyddet i kassan är aktivt behandlar Cloudflare
            Inc. (Turnstile) er IP-adress för att skilja människor från robotar, och när ni godkänt
            statistik i cookiebannern behandlar Google Ireland Ltd (Google Analytics 4)
            pseudonymiserade besöksdata. Bolagen är amerikanska eller har amerikanska moderbolag; i
            den mån uppgifter överförs utanför EU/EES sker det med stöd av EU–US Data Privacy
            Framework eller EU-kommissionens standardavtalsklausuler.
          </p>
        </section>
        <section>
          <h2>Cookies och lokal lagring</h2>
          <p>
            {process.env.NEXT_PUBLIC_GA4_ID
              ? "Webbplatsen kan använda Google Analytics 4 för pseudonymiserad besöksstatistik — men bara om ni godkänner det i bannern. Utan samtycke laddas inget Google-script och inga statistikcookies sätts. "
              : "Webbplatsen använder inga spårnings- eller marknadsföringscookies. "}
            Varukorgen och ert cookieval lagras i webbläsarens lokala lagring och en nödvändig
            sessionskaka används enbart för administratörens inloggning — ingen av dessa kräver
            samtycke.
          </p>
          {process.env.NEXT_PUBLIC_GA4_ID ? <ConsentReset /> : null}
        </section>
        <section>
          <h2>Era rättigheter</h2>
          <p>
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
