// Fullt flödestest (E2E) mot ett körande produktionsbygge:
//   npm run build && PORT=3122 CRON_SECRET=… ADMIN_NOTIFY_EMAIL=… npm start
//   DATABASE_URL=… E2E_CRON_SECRET=<serverns CRON_SECRET> npx tsx scripts/e2e/full-flow.mts
// Kräver Chromium (CHROMIUM_PATH), en admin (E2E_ADMIN_EMAIL/PASSWORD) och en
// tom/lokal databas — skriptet skapar ordrar, prenumerationer och kreditfakturor.
// Kör ALDRIG mot produktion. Varje körning gör två admininloggningar (en
// felaktig, en riktig) — inloggningsspärren tillåter fem per fem minuter och
// IP, så vänta minst fem minuter mellan tredje och fjärde körningen.
import { chromium } from "playwright-core";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { prisma } from "../../src/lib/db";
import { addDays, toISODate } from "../../src/lib/dates";

const B = process.env.BASE ?? "http://127.0.0.1:3122";
// OBS: Prisma läser .env vid import, så process.env.CRON_SECRET kan vara
// .env-värdet och inte serverns. Ange därför serverns hemlighet separat.
const CRON = process.env.E2E_CRON_SECRET ?? "revisionshemlighet";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "audit@sockerbagaren.se";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Audit-Losen-2026!";
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const RUN = Date.now() % 100000;
const results: [string, string, string][] = [];
const check = (name: string, ok: boolean, extra = "") => {
  results.push([ok ? "PASS" : "FAIL", name, extra]);
  console.log((ok ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : ""));
};
const section = (t: string) => console.log("\n## " + t);
function orgNr(base9: string) {
  const d = base9.replace(/\D/g, "").slice(0, 9).padStart(9, "5");
  let sum = 0;
  for (let i = 0; i < 9; i++) { let x = +d[i]; if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9; } sum += x; }
  const f = d + ((10 - (sum % 10)) % 10);
  return f.slice(0, 6) + "-" + f.slice(6);
}
const pdfText = async (path: string) => {
  const res = await fetch(B + path);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, text: (await pdfParse(buf)).text.replace(/\s+/g, " ") };
};
const emails = (orderId: string) => prisma.emailLog.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });

const products = await prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
const byName = (n: string) => products.find((p) => p.name === n)!;
const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
const weekdays: number[] = JSON.parse(area.weekdaysJson);

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
const pageErrors: string[] = [];
async function newPage(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 120)));
  page.on("dialog", (d) => d.accept("Flödestest " + RUN));
  return { ctx, page };
}
async function fillForm(page: any, overrides: Record<string, string> = {}) {
  const v: Record<string, string> = {
    "Företagsnamn": "Flödesbolaget AB",
    "Organisationsnummer": orgNr(`${556000 + (RUN % 1000)}771`),
    "Kontaktperson": "Flöde Testsson",
    "Telefon": "070-123 45 67",
    "E-post": `flode-${RUN}@testbolaget.se`,
    "Leveransadress": "Flödesvägen 1",
    "Postnummer": "135 48",
    "Ort": "Tyresö",
    ...overrides,
  };
  for (const [label, val] of Object.entries(v)) await page.getByLabel(label, { exact: true }).fill(val);
}
async function pickAreaAndDate(page: any, recurring: boolean) {
  await page.getByRole("button", { name: "Tyresö", exact: true }).click();
  await page.locator("button.choice-btn", { hasText: recurring ? "Första leverans" : "under dagen" }).first().click();
}
function apiPayload(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: `flow-${RUN}-${Math.random().toString(36).slice(2, 12)}`,
    items: [{ productId: byName("Kolasnittar").id, weightKg: 3 }],
    areaSlug: "tyreso",
    deliveryDate: "",
    companyName: "API-bolaget AB",
    orgNumber: orgNr(`${556100 + (RUN % 800)}112`),
    contactName: "Api Person",
    email: `api-${RUN}@testbolaget.se`,
    phone: "070-123 45 67",
    deliveryAddress: "Apivägen 2",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "",
    invoiceEmail: `api-${RUN}@testbolaget.se`,
    reference: "",
    billingAddress: "",
    ...overrides,
  };
}
const post = async (path: string, body: unknown) => {
  const res = await fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  let data: any = null;
  try { data = await res.json(); } catch { /* ej json */ }
  return { status: res.status, data };
};
// Nästa giltiga leveransdag för området från och med "from"
function nextDeliveryDate(from: Date, minDaysAhead: number) {
  for (let i = minDaysAhead; i < minDaysAhead + 14; i++) {
    const d = addDays(from, i);
    if (weekdays.includes(d.getDay())) return d;
  }
  throw new Error("ingen leveransdag");
}
// Två körningar tätt inpå varandra: rate limit-spärren (10/min per IP) från
// förra körningens sista sektion ska ha löpt ut innan kassan används.
for (let i = 0; i < 8; i++) {
  const probe = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (probe.status !== 429) break;
  const wait = Number(probe.headers.get("retry-after") ?? "10") + 1;
  console.log(`   (rate limit aktiv från tidigare körning — väntar ${wait} s)`);
  await new Promise((r) => setTimeout(r, wait * 1000));
}

const today = new Date();
const validDate = toISODate(nextDeliveryDate(today, area.leadTimeDays + 1));

let orderA: any = null;
let subNumber = "";
let cronOrder: any = null;
let partialOrder: any = null;

// ---------------- 1. KUND: engångsköp i UI ----------------
section("1. Kund — engångsköp (desktop)");
try {
  const { ctx, page } = await newPage();
  await page.goto(B + "/");
  await page.getByRole("link", { name: "Beställ kakor" }).first().click();
  await page.waitForURL("**/bestall");
  await page.getByRole("button", { name: "Öka Kolasnittar" }).click({ clickCount: 2 });
  await page.getByRole("button", { name: "Öka Mandelkubb" }).click();
  await page.getByRole("button", { name: "Fortsätt till leverans" }).click();
  await page.getByRole("button", { name: /Engångsbeställning/ }).click();
  await pickAreaAndDate(page, false);
  await page.getByRole("button", { name: "Fortsätt till företagsuppgifter" }).click();
  await fillForm(page);
  await page.getByRole("button", { name: "Kontrollera order" }).click();
  const s4 = await page.textContent("body");
  check("steg 4 visar rader, ordertyp och pris", s4!.includes("Kolasnittar") && s4!.includes("Mandelkubb") && s4!.includes("Engångsbeställning") && /Skicka beställning · /.test(s4!));
  await page.getByRole("button", { name: /Skicka beställning/ }).click();
  await page.waitForSelector("text=Vi har tagit emot er beställning", { timeout: 30000 });
  const body = await page.textContent("body");
  const m = body!.match(/ORDER (SB-\d+)/);
  check("tack-sida med ordernummer och leverans", !!m && body!.includes("Flödesvägen 1") && /dagar efter leveransen/.test(body!), m?.[1] ?? "");
  const invoiceLink = await page.locator('a[href^="/faktura/"]').first().getAttribute("href").catch(() => null);
  check("tack-sida länkar till fakturan", !!invoiceLink, invoiceLink ?? "saknas");
  await ctx.close();
  orderA = await prisma.order.findUnique({ where: { orderNumber: m![1] }, include: { items: true, invoice: true } });
  check("DB: order NY, obetald, ej levererad, 2 rader, 3 kg", orderA.status === "NEW" && orderA.paymentStatus === "UNPAID" && orderA.deliveryStatus === "PENDING" && orderA.items.length === 2 && orderA.items.reduce((s: number, i: any) => s + i.weightKg, 0) === 3);
  const expNet = 2 * byName("Kolasnittar").pricePerKgOre + byName("Mandelkubb").pricePerKgOre;
  check("DB: serverberäknade summor (6 % moms)", orderA.subtotalOre === expNet && orderA.vatOre === Math.round(expNet * 0.06) && orderA.totalOre === expNet + Math.round(expNet * 0.06));
  check("DB: faktura obetald, förfallodag = leverans + 30", orderA.invoice.status === "UNPAID" && toISODate(orderA.invoice.dueDate) === toISODate(addDays(orderA.deliveryDate, 30)));
  const mails = await emails(orderA.id);
  const types = mails.map((e) => e.type);
  check("e-postlogg: orderbekräftelse + faktura + adminavisering", types.includes("ORDER_CONFIRMATION") && types.includes("INVOICE") && types.includes("ADMIN_NEW_ORDER"), types.join(","));
  check("e-postlogg: inga FAILED", mails.every((e) => e.status !== "FAILED"), mails.map((e) => e.status).join(","));
  const pdf = await pdfText(`/faktura/${orderA.invoice.downloadToken}`);
  check("faktura-PDF: nummer, 6 % moms, villkor från leverans, företag", pdf.status === 200 && pdf.text.includes(orderA.invoice.invoiceNumber) && pdf.text.includes("Moms 6 %") && pdf.text.includes("dagar netto från leverans") && pdf.text.includes("Flödesbolaget AB") && pdf.text.includes("Planerad leverans"));
} catch (e: any) { check("1. engångsköp", false, e.message.slice(0, 200)); }

// ---------------- 2. Idempotens via API ----------------
section("2. API — idempotens och prisspärr");
try {
  const p = apiPayload({ deliveryDate: validDate });
  const a = await post("/api/orders", p);
  const b = await post("/api/orders", p);
  check("samma nyckel två gånger → samma order", a.status === 200 && b.status === 200 && a.data.orderNumber === b.data.orderNumber, `${a.status}/${b.status} ${a.data?.orderNumber}`);
  const c = await post("/api/orders", { ...p, companyName: "Annat AB" });
  check("samma nyckel, annan payload → 409 IDEMPOTENCY_MISMATCH", c.status === 409 && c.data?.code === "IDEMPOTENCY_MISMATCH");
  const d = await post("/api/orders", apiPayload({ deliveryDate: validDate, expectedTotalOre: 1 }));
  check("fel förväntad summa → 409 PRICE_CHANGED", d.status === 409 && d.data?.code === "PRICE_CHANGED");
  partialOrder = await prisma.order.findUnique({ where: { orderNumber: a.data.orderNumber }, include: { invoice: true } });
} catch (e: any) { check("2. API", false, e.message.slice(0, 200)); }

// ---------------- 3. KUND: prenumeration i UI (mobil) ----------------
section("3. Kund — fikaprenumeration (mobil)");
try {
  const { ctx, page } = await newPage({ width: 390, height: 844 });
  await page.goto(B + "/prenumeration");
  await page.getByRole("link", { name: "Välj kakor" }).first().click();
  await page.waitForURL("**/bestall?typ=aterkommande");
  await page.getByRole("button", { name: "Öka Chokladsnittar" }).click();
  await page.getByRole("button", { name: "Fortsätt till leverans" }).click();
  const pressed = await page.getByRole("button", { name: /^Fikaprenumeration/ }).getAttribute("aria-pressed");
  check("prenumeration förvald från /prenumeration", pressed === "true");
  await page.getByRole("button", { name: /Varannan vecka/ }).click();
  await pickAreaAndDate(page, true);
  await page.getByRole("button", { name: "Fortsätt till företagsuppgifter" }).click();
  await fillForm(page, { "E-post": `pren-${RUN}@testbolaget.se`, "Företagsnamn": "Prenumerantbolaget AB" });
  await page.getByRole("button", { name: "Kontrollera order" }).click();
  const s4 = await page.textContent("body");
  check("steg 4 visar intervall och pris per leverans", s4!.includes("varannan vecka") && s4!.includes("per leverans"));
  await page.getByRole("button", { name: /Skicka beställning/ }).click();
  await page.waitForSelector("text=/fikaprenumeration är igång/i", { timeout: 30000 });
  const body = await page.textContent("body");
  const m = body!.match(/PRENUMERATION (PREN-\d+)/);
  subNumber = m?.[1] ?? "";
  check("tack-sida med prenumerationsnummer", !!subNumber, subNumber);
  await ctx.close();
  const sub = await prisma.subscription.findUnique({ where: { number: subNumber } });
  check("DB: prenumeration ACTIVE, varannan vecka, nästa leverans i framtiden", sub?.status === "ACTIVE" && sub?.frequency === "BIWEEKLY" && sub.nextDeliveryDate > today);
  const mails = await prisma.emailLog.findMany({ where: { to: `pren-${RUN}@testbolaget.se` } });
  check("e-postlogg: prenumerationsbekräftelse skickad", mails.length >= 1 && mails.every((e) => e.status !== "FAILED"), mails.map((e) => e.type).join(","));
} catch (e: any) { check("3. prenumeration", false, e.message.slice(0, 200)); }

// ---------------- 4. CRON ----------------
section("4. Cron — prenumerationsgenerering");
try {
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { number: subNumber } });
  const target = nextDeliveryDate(today, 1);
  const withinHorizon = target <= addDays(today, 3);
  await prisma.subscription.update({ where: { id: sub.id }, data: { nextDeliveryDate: target } });
  const noAuth = await fetch(B + "/api/cron/generate-subscription-orders");
  check("cron utan hemlighet → 401", noAuth.status === 401);
  const run1 = await (await fetch(B + "/api/cron/generate-subscription-orders", { headers: { Authorization: `Bearer ${CRON}` } })).json();
  let generated = run1.generated?.some((g: any) => g.subscriptionNumber === subNumber);
  if (!generated && !withinHorizon) {
    // Nästa leveransdag ligger bortom cronens 3-dagarshorisont — kör motorn med bredare horisont.
    const { generateDueSubscriptionOrders } = await import("../../src/lib/subscriptions/service");
    const r = await generateDueSubscriptionOrders({ horizonDays: 10 });
    generated = r.generated.some((g: any) => g.subscriptionNumber === subNumber);
    console.log("   (leveransdag utanför horisonten — motorn kördes direkt med 10 dagars horisont)");
  }
  check("cron genererar order för prenumerationen", !!generated, JSON.stringify({ ok: run1.ok, generated: run1.generated?.length, skipped: run1.skipped?.length }));
  cronOrder = await prisma.order.findFirst({ where: { subscriptionId: sub.id }, include: { invoice: true }, orderBy: { createdAt: "desc" } });
  check("DB: genererad order har faktura och period", !!cronOrder?.invoice && !!cronOrder?.subscriptionPeriod);
  const run2 = await (await fetch(B + "/api/cron/generate-subscription-orders", { headers: { Authorization: `Bearer ${CRON}` } })).json();
  const count = await prisma.order.count({ where: { subscriptionId: sub.id } });
  check("cron igen svarar ok", run2.ok === true, JSON.stringify(run2).slice(0, 160));
  check("cron igen → ingen dubblett (unik period)", count === 1, `ordrar: ${count}`);
  const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  check("nästa leveransdatum flyttat fram 14 dagar", toISODate(after.nextDeliveryDate) === toISODate(addDays(target, 14)), `${toISODate(target)} → ${toISODate(after.nextDeliveryDate)}`);
  if (cronOrder) {
    const t = (await emails(cronOrder.id)).map((e) => e.type);
    check("e-postlogg: genererad order fick bekräftelse + faktura", t.includes("ORDER_CONFIRMATION") && t.includes("INVOICE"), t.join(","));
  }
} catch (e: any) { check("4. cron", false, e.message.slice(0, 200)); }

// ---------------- 5. ADMIN (en inloggning) ----------------
section("5. Admin — inloggning, order, leverans, betalning");
const admin = await newPage();
try {
  const { page } = admin;
  const r = await page.goto(B + "/admin/bestallningar");
  check("oinloggad → login", page.url().includes("/admin/login"));
  await page.getByLabel(/E-post/).fill(ADMIN_EMAIL);
  await page.getByLabel(/Lösenord/).fill("fel-losenord-123");
  await page.getByRole("button", { name: /Logga in/ }).click();
  await page.waitForTimeout(1200);
  check("fel lösenord → stannar på login med fel", page.url().includes("/admin/login") && /fel|stämmer|ogiltig/i.test((await page.textContent("body"))!));
  await page.getByLabel(/Lösenord/).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Logga in/ }).click();
  await page.waitForURL((u: URL) => !u.pathname.includes("/admin/login"), { timeout: 20000 });
  const dash = await page.textContent("body");
  check("översikten visar nya beställningar och momspåminnelse", /Nya beställningar/.test(dash!) && /Momssats/.test(dash!));
  await page.goto(B + "/admin/bestallningar?filter=nya");
  check("listan över nya beställningar innehåller ordern", (await page.textContent("body"))!.includes(orderA.orderNumber));
  await page.goto(B + `/admin/leveranser`);
  check("leveranslistan innehåller ordern", (await page.textContent("body"))!.includes(orderA.orderNumber));

  await page.goto(B + `/admin/bestallningar/${orderA.id}`);
  await page.getByRole("button", { name: "Bekräfta order" }).click();
  await page.waitForSelector("text=Bekräftad", { timeout: 15000 });
  check("bekräfta order → status Bekräftad", true);
  await page.getByLabel("Leveransnotering").fill("Lämnat i receptionen");
  await page.getByRole("button", { name: "Markera som levererad" }).click();
  await page.waitForSelector("text=Lämnat i receptionen", { timeout: 15000 });
  await page.getByRole("button", { name: "Markera som betald" }).click();
  // Vänta på att betalningen faktiskt registrerats (serveråtgärd + revalidering), inte på ett gammalt statusmeddelande.
  let dbA: any = null;
  for (let i = 0; i < 30; i++) {
    dbA = await prisma.order.findUniqueOrThrow({ where: { id: orderA.id }, include: { invoice: true, events: true } });
    if (dbA.paymentStatus === "PAID") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await page.reload();
  const detail = await page.textContent("body");
  check("levererad + betald i DB och UI", dbA.deliveryStatus === "DELIVERED" && dbA.paymentStatus === "PAID" && dbA.invoice!.status === "PAID" && detail!.includes("Betald") && detail!.includes("Levererad"));
  check("historik: CONFIRMED, DELIVERED, PAID", ["CONFIRMED", "DELIVERED", "PAID"].every((t) => dbA.events.some((e) => e.type === t)), dbA.events.map((e) => e.type).join(","));
  await page.getByRole("button", { name: "Skicka faktura igen" }).click();
  await page.waitForSelector('[role="alert"], [role="status"]', { timeout: 15000 });
  const fb = await page.locator(".info-box[role='status'], .error-text[role='alert']").first().textContent();
  check("skicka faktura igen på betald faktura blockeras", /betald/i.test(fb ?? ""), (fb ?? "").trim().slice(0, 80));
  await page.getByLabel("Intern notering", { exact: true }).fill("Kunden vill ha leverans till plan 3");
  await page.getByRole("button", { name: "Spara notering" }).click();
  await page.waitForSelector("text=Kunden vill ha leverans till plan 3", { timeout: 15000 });
  check("notering sparas i historiken", true);
  await page.goto(B + "/admin/fakturor?filter=betalda");
  check("reskontra: betald faktura listas under Betalda", (await page.textContent("body"))!.includes(dbA.invoice!.invoiceNumber));
} catch (e: any) { check("5. admin orderflöde", false, e.message.slice(0, 200)); }

// ---------------- 6. Avbryt + hel kreditering ----------------
section("6. Admin — avbryt order → kreditfaktura");
try {
  const { page } = admin;
  await page.goto(B + `/admin/bestallningar/${cronOrder.id}`);
  await page.getByRole("button", { name: "Avbryt order" }).click();
  await page.waitForSelector("text=/Kreditfaktura \\d+ utfärdad/", { timeout: 20000 });
  await page.reload();
  const body = await page.textContent("body");
  const db = await prisma.order.findUniqueOrThrow({ where: { id: cronOrder.id }, include: { invoice: { include: { creditNotes: true } } } });
  const cn = db.invoice!.creditNotes[0];
  check("order avbruten, faktura CREDITED, FULL kreditnota", db.status === "CANCELLED" && db.invoice!.status === "CREDITED" && cn?.kind === "FULL" && cn.totalOre === -db.invoice!.totalOre);
  check("UI: 'Krediterad i sin helhet' + kreditlänk", body!.includes("Krediterad i sin helhet") && body!.includes(cn.creditNumber));
  const mails = (await emails(cronOrder.id)).map((e) => e.type);
  check("e-postlogg: kreditfaktura mejlad", mails.includes("CREDIT_NOTE"), mails.join(","));
  const pdf = await pdfText(`/faktura/${cn.downloadToken}`);
  check("kredit-PDF: KREDITFAKTURA, i sin helhet, negativt belopp", pdf.text.includes("KREDITFAKTURA") && pdf.text.includes("i sin helhet") && /Krediterat belopp\s*-/.test(pdf.text));
  check("nummerserien obruten (kredit > faktura)", Number(cn.creditNumber) > Number(db.invoice!.invoiceNumber));
} catch (e: any) { check("6. avbryt/kredit", false, e.message.slice(0, 200)); }

// ---------------- 7. Delkreditering ----------------
section("7. Admin — delkreditering");
try {
  const { page } = admin;
  await page.goto(B + `/admin/bestallningar/${partialOrder.id}`);
  await page.locator('input[aria-label^="Antal"]').first().fill("1");
  await page.fill('input[aria-label="Anledning till krediteringen"]', "Saknad vikt");
  await page.getByRole("button", { name: "Utfärda delkreditfaktura" }).click();
  await page.waitForSelector("text=/Kreditfaktura \\d+ \\(/", { timeout: 20000 });
  await page.reload();
  const body = await page.textContent("body");
  const db = await prisma.order.findUniqueOrThrow({ where: { id: partialOrder.id }, include: { invoice: { include: { creditNotes: true } } } });
  const cn = db.invoice!.creditNotes[0];
  const price = byName("Kolasnittar").pricePerKgOre;
  check("PARTIAL kreditnota på 1 kg, faktura kvar som obetald", cn?.kind === "PARTIAL" && db.invoice!.status === "UNPAID" && cn.subtotalOre === -price);
  check("UI: Delkreditfaktura + återstår att betala", body!.includes("Delkreditfaktura") && body!.includes("Återstår att betala"));
  const pdf = await pdfText(`/faktura/${cn.downloadToken}`);
  check("delkredit-PDF: delvis + anledning", pdf.text.includes("delvis") && pdf.text.includes("Anledning: Saknad vikt"));
  await page.locator('input[aria-label^="Antal"]').first().fill("5");
  await page.getByRole("button", { name: "Utfärda delkreditfaktura" }).click();
  await page.waitForSelector("text=/återstår att kreditera/", { timeout: 20000 });
  check("för stor mängd avvisas med tydligt fel", true);
  await page.goto(B + "/admin/fakturor");
  check("reskontra visar Delkredit och 'att betala'", (await page.textContent("body"))!.includes("Delkredit " + cn.creditNumber));
} catch (e: any) { check("7. delkreditering", false, e.message.slice(0, 200)); }

// ---------------- 8. Prenumerationsstyrning ----------------
section("8. Admin — prenumeration: pausa, återaktivera, datum, avsluta");
try {
  const { page } = admin;
  await page.goto(B + "/admin/prenumerationer");
  const row = page.locator(".card", { hasText: subNumber }).first();
  await row.getByRole("button", { name: "Pausa" }).click();
  await page.waitForTimeout(1500);
  let sub = await prisma.subscription.findUniqueOrThrow({ where: { number: subNumber } });
  check("pausa → PAUSED", sub.status === "PAUSED");
  await page.reload();
  await page.locator(".card", { hasText: subNumber }).first().getByRole("button", { name: "Återaktivera" }).click();
  await page.waitForTimeout(1500);
  sub = await prisma.subscription.findUniqueOrThrow({ where: { number: subNumber } });
  check("återaktivera → ACTIVE", sub.status === "ACTIVE");
  await page.reload();
  const r2 = page.locator(".card", { hasText: subNumber }).first();
  const bad = toISODate(addDays(nextDeliveryDate(today, 8), 1)); // dagen efter en leveransdag = ogiltig
  await r2.locator('input[type="date"]').fill(bad);
  await r2.getByRole("button", { name: "Spara" }).click();
  await page.waitForSelector('[role="alert"]', { timeout: 15000 });
  check("ogiltig veckodag avvisas", true, bad);
  const good = toISODate(nextDeliveryDate(today, 8));
  await r2.locator('input[type="date"]').fill(good);
  await r2.getByRole("button", { name: "Spara" }).click();
  await page.waitForTimeout(1500);
  sub = await prisma.subscription.findUniqueOrThrow({ where: { number: subNumber } });
  check("giltig leveransdag sparas", toISODate(sub.nextDeliveryDate) === good, good);
  await page.reload();
  await page.locator(".card", { hasText: subNumber }).first().getByRole("button", { name: "Avsluta" }).click();
  await page.waitForTimeout(1500);
  sub = await prisma.subscription.findUniqueOrThrow({ where: { number: subNumber } });
  check("avsluta → CANCELLED", sub.status === "CANCELLED");
  await page.goto(B + "/admin/prenumerationer?filter=avslutade");
  check("avslutad prenumeration listas under Avslutade", (await page.textContent("body"))!.includes(subNumber));
} catch (e: any) { check("8. prenumerationsstyrning", false, e.message.slice(0, 200)); }

// ---------------- 9. Produkter ----------------
section("9. Admin — produktredigering och inaktivering");
try {
  const { page } = admin;
  const kola = byName("Kolasnittar");
  await page.goto(B + `/admin/produkter/${kola.id}`);
  await page.fill('input[name="badge"]', "Flödestest");
  await page.getByRole("button", { name: /Spara/ }).click();
  await page.waitForTimeout(2000);
  const pub = await (await fetch(B + "/kakor/kolasnittar")).text();
  check("etikett ändrad i admin syns på publik produktsida", pub.includes("Flödestest"));
  await page.goto(B + `/admin/produkter/${kola.id}`);
  await page.fill('input[name="badge"]', kola.badge ?? "Bästsäljare");
  await page.getByRole("button", { name: /Spara/ }).click();
  await page.waitForTimeout(1500);
  const choklad = byName("Chokladsnittar");
  await page.goto(B + "/admin/produkter");
  await page.locator("tr", { hasText: "Chokladsnittar" }).getByRole("button", { name: "Inaktivera" }).click();
  await page.waitForTimeout(1500);
  const kakor = await (await fetch(B + "/kakor")).text();
  const apiRes = await post("/api/orders", apiPayload({ deliveryDate: validDate, items: [{ productId: choklad.id, weightKg: 1 }] }));
  check("inaktiverad produkt borta från /kakor och avvisas i API", !kakor.includes("/kakor/chokladsnittar") && apiRes.status === 400 && /finns inte/.test(apiRes.data?.error ?? ""), `${apiRes.status} ${apiRes.data?.error ?? ""}`);
  await page.reload();
  await page.locator("tr", { hasText: "Chokladsnittar" }).getByRole("button", { name: "Aktivera" }).click();
  await page.waitForTimeout(1500);
  const back = await prisma.product.findUniqueOrThrow({ where: { id: choklad.id } });
  check("återaktiverad", back.active === true);
  await page.goto(B + "/admin/installningar");
  check("inställningar visar leveransdagar och fakturauppgifter", /[Tt]orsdag/.test((await page.textContent("body"))!) && (await page.textContent("body"))!.includes("dagar netto"));
} catch (e: any) { check("9. produkter", false, e.message.slice(0, 200)); }

// ---------------- 10. Utloggning ----------------
try {
  const { page } = admin;
  await page.goto(B + "/admin");
  await page.getByRole("button", { name: /Logga ut/ }).first().click();
  await page.waitForTimeout(1200);
  await page.goto(B + "/admin/bestallningar");
  check("utloggning → skyddade sidor kräver login igen", page.url().includes("/admin/login"));
  await admin.ctx.close();
} catch (e: any) { check("10. utloggning", false, e.message.slice(0, 200)); }

// ---------------- 11. Felfall ----------------
section("11. Felfall och skydd");
console.log("   (väntar 65 s så att rate limit-fönstret från tidigare anrop löper ut)");
await new Promise((r) => setTimeout(r, 65000));
try {
  const hp = await post("/api/orders", apiPayload({ deliveryDate: validDate, sb_extra: "spam" }));
  check("honeypot ifyllt → 400", hp.status === 400);
  const luhn = await post("/api/orders", apiPayload({ deliveryDate: validDate, orgNumber: "556000-0002" }));
  check("ogiltigt organisationsnummer (fel kontrollsiffra) → 400 fältfel", luhn.status === 400 && !!luhn.data?.fields?.orgNumber, `${luhn.status} ${JSON.stringify(luhn.data?.fields ?? luhn.data?.error)}`);
  const past = await post("/api/orders", apiPayload({ deliveryDate: toISODate(addDays(today, -7)) }));
  check("leveransdag i det förflutna → 400", past.status === 400);
  const badJson = await post("/api/orders", "{not json");
  check("trasig JSON → 400", badJson.status === 400);
  const inactiveArea = await post("/api/orders", apiPayload({ deliveryDate: validDate, deliveryPostalCode: "111 22", deliveryCity: "Stockholm" }));
  check("postnummer utanför området → 400", inactiveArea.status === 400, `${inactiveArea.status} ${String(inactiveArea.data?.error ?? "").slice(0, 60)}`);
  const f404 = await fetch(B + "/faktura/" + "a".repeat(48));
  check("okänd fakturatoken → 404", f404.status === 404);
  const p404 = await fetch(B + "/kakor/finns-inte");
  check("okänd produkt → 404-sida", p404.status === 404 && /Sidan finns inte|hittades inte|404/i.test(await p404.text()));
  const robots = await (await fetch(B + "/robots.txt")).text();
  const sitemap = await (await fetch(B + "/sitemap.xml")).text();
  check("robots blockerar admin/api/faktura, sitemap har guiden", /Disallow: \/admin/.test(robots) && sitemap.includes("/fika-till-jobbet"));
  const csp = (await fetch(B + "/bestall")).headers.get("content-security-policy") ?? "";
  check("CSP med nonce på kassan", /nonce-/.test(csp) && /strict-dynamic/.test(csp));
} catch (e: any) { check("11. felfall", false, e.message.slice(0, 200)); }

// ---------------- 12. Rate limit (sist — låser IP:n i en minut) ----------------
section("12. Rate limit");
try {
  let got429 = false;
  for (let i = 0; i < 14; i++) {
    const r = await post("/api/orders", "{}");
    if (r.status === 429) { got429 = true; break; }
  }
  check("fler än 10 anrop/min → 429", got429);
} catch (e: any) { check("12. rate limit", false, e.message.slice(0, 200)); }

check("inga JS-fel i webbläsaren under hela flödet", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
await browser.close();
await prisma.$disconnect();
const failed = results.filter((r) => r[0] === "FAIL");
console.log(`\n==== FULLT FLÖDESTEST: ${results.length - failed.length}/${results.length} PASS ====`);
if (failed.length) console.log(failed.map((f) => "  ✗ " + f[1] + (f[2] ? " — " + f[2] : "")).join("\n"));
process.exit(failed.length ? 1 : 0);
