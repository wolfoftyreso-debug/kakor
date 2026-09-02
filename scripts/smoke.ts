// Production smoke test — körs mot en deployad miljö efter deploy/Neon-koppling.
//
//   npx tsx scripts/smoke.ts https://sockerbagaren.vercel.app
//   npx tsx scripts/smoke.ts https://sockerbagaren.se --order   (lägger testorder)
//
// --order skapar en RIKTIG order (märkt SMOKE TEST) och verifierar faktura-PDF:n.
// Avsluta med icke-noll exitkod vid fel — kan användas i CI/Grokbot-flöden.

const base = (process.argv[2] ?? "").replace(/\/$/, "");
const placeOrder = process.argv.includes("--order");
if (!base.startsWith("http")) {
  console.error("Användning: npx tsx scripts/smoke.ts <bas-URL> [--order]");
  process.exit(2);
}

let failures = 0;
function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function checkPage(path: string, marker: string) {
  try {
    const res = await fetch(base + path);
    const html = await res.text();
    report(`GET ${path}`, res.status === 200 && html.includes(marker), `status ${res.status}`);
  } catch (e) {
    report(`GET ${path}`, false, e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  // Health först — talar om ifall databasen är kopplad.
  const health = await fetch(`${base}/api/health`).then(
    async (r) => ({ status: r.status, body: await r.json().catch(() => null) }),
    (e) => ({ status: 0, body: null, error: e })
  );
  const dbUp = health.body?.database === "ok";
  report("GET /api/health", health.status === 200 || health.status === 503, JSON.stringify(health.body));
  if (!dbUp) {
    console.log("  ⚠ databasen är inte kopplad — sidkontroller som kräver databas hoppar över.");
  }

  await checkPage("/om", "Sockerbagaren");
  await checkPage("/villkor", "faktura");
  await checkPage("/robots.txt", "Sitemap:");

  if (dbUp) {
    await checkPage("/", "Riktigt fika till jobbet");
    await checkPage("/kakor", "Våra kakor");
    await checkPage("/kakor/mandelkubb", "Mandelkubb");
    await checkPage("/tyreso", "Tyresö");
    await checkPage("/bestall", "Välj kakor");
    await checkPage("/sitemap.xml", "/kakor/");

    if (placeOrder) {
      // Hämta produkt-id + giltig leveransdag från publika sidan/sitemapen går inte —
      // vi läser produktsidan för slug och låter servern validera datumet:
      // enklast robusta vägen är att hämta datum ur checkout kräver JS; istället
      // beräknas nästa torsdag minst 3 dagar fram (seedens standard: endast torsdag).
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 3);
      while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1);
      const deliveryDate = d.toISOString().slice(0, 10);

      // Produkt-id:n är interna — hämta via order-API:ts felrespons går inte;
      // därför exponerar vi inget nytt: testordern kräver ett produkt-id som
      // operatören hämtar från admin. Utan id: hoppa över med instruktion.
      const productId = process.env.SMOKE_PRODUCT_ID;
      if (!productId) {
        report("Testorder", true, "hoppas över — sätt SMOKE_PRODUCT_ID (från admin → Produkter) för full ordertest");
      } else {
        const res = await fetch(`${base}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: `smoke-${Date.now()}`,
            items: [{ productId, weightKg: 1 }],
            areaSlug: "tyreso",
            deliveryDate,
            companyName: "SMOKE TEST — RADERA",
            orgNumber: "556000-0000",
            contactName: "Smoke Test",
            email: "smoke@example.com",
            phone: "070-000 00 00",
            deliveryAddress: "Testgatan 1",
            deliveryPostalCode: "135 48",
            deliveryCity: "Tyresö",
            deliveryInstruction: "SMOKE TEST",
            invoiceEmail: "smoke@example.com",
            reference: "SMOKE",
            billingAddress: "",
          }),
        });
        const data = await res.json().catch(() => null);
        report("POST /api/orders (testorder)", res.status === 200 && data?.ok, data?.orderNumber ?? `status ${res.status}`);
        if (data?.invoiceUrl) {
          const pdf = await fetch(base + data.invoiceUrl);
          const buf = new Uint8Array(await pdf.arrayBuffer());
          const isPdf = pdf.status === 200 && buf[0] === 0x25 && buf[1] === 0x50; // %P
          report("GET faktura-PDF", isPdf, `${pdf.status}, ${buf.length} bytes`);
          console.log(`  → avbryt testordern ${data.orderNumber} i admin efteråt.`);
        }
      }
    }
  }

  console.log(failures === 0 ? "\nSMOKE: PASS" : `\nSMOKE: FAIL (${failures} fel)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
