import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

function demoOrgNumber(base9: string): string {
  const digits = base9.replace(/\D/g, "").slice(0, 9).padStart(9, "5");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  const full = digits + String(check);
  return `${full.slice(0, 6)}-${full.slice(6)}`;
}

// OBS: priserna nedan är START-/PLATSHÅLLARPRISER som verksamheten ska
// bekräfta eller ändra i admin (Produkter). Historiska ordrar påverkas inte.
import { FOOD_VAT_RATE_BP } from "../src/lib/vat";
import { toISODate, upcomingDeliveryDates } from "../src/lib/dates";
import { createOrder } from "../src/lib/orders/create-order";
import { createSubscription, generateDueSubscriptionOrders } from "../src/lib/subscriptions/service";

const products = [
  {
    slug: "mandelkubb",
    name: "Mandelkubb",
    description:
      "Mör, mandeldoftande och rejäl – en tät svensk klassiker med gyllene, lätt knaprig yta och mjuk, smörig kärna. Generös med mandeln och med en rund sötma som gör sig perfekt till kaffet.",
    pricePerKgOre: 29500,
    ingredients:
      "Vetemjöl, smör, socker, mandel, ägg, bakpulver, keltiskt salt.",
    allergens: "Innehåller vete, mandel, ägg, smör (mjölk).",
    imageRef: "/images/mandelkubb.jpg",
    sortOrder: 1,
  },
  {
    slug: "kolasnittar",
    name: "Kolasnittar",
    description:
      "Vår bästsäljare – nötig, med toner av brynt smör och knäck och en vuxen sälta. Härligt frasig klassisk småkaka med seg kärna och lätt smörfriterad botten.",
    pricePerKgOre: 29500,
    ingredients: "Vetemjöl, smör, socker, ljus sirap, vaniljsocker, bikarbonat, keltiskt salt.",
    allergens: "Innehåller vete, smör (mjölk). Kan innehålla spår av mandel.",
    imageRef: "/images/kolasnittar.jpg",
    badge: "Bästsäljare",
    sortOrder: 2,
  },
  {
    slug: "chokladsnittar",
    name: "Chokladsnittar",
    description:
      "Djup chokladkaraktär av mörk choklad och kakao – härligt frasiga snittar med seg kärna, rund sötma av ljus sirap och en fin sälta som lyfter chokladen.",
    pricePerKgOre: 29500,
    ingredients:
      "Vetemjöl, smör, socker, mörk choklad, kakao, ljus sirap, vaniljsocker, bakpulver, keltiskt salt.",
    allergens: "Innehåller vete, smör (mjölk). Kan innehålla spår av mandel och soja.",
    imageRef: "/images/chokladsnittar.jpg",
    sortOrder: 3,
  },
  {
    // Styckvara: säljs per paket (pricePerKgOre = pris per paket).
    // Startpris = 1,5 kg × startpriset 295 kr/kg – bekräftas/ändras i admin.
    slug: "prova-pa-paket",
    name: "Prova-på-paket",
    description:
      "1,5 kg småkakor – 0,5 kg vardera av mandelkubb, kolasnittar och chokladsnittar. Hela sortimentet i en beställning: det enkla sättet att låta arbetsplatsen provsmaka och hitta sin favorit.",
    pricePerKgOre: 44250,
    unit: "paket",
    packageWeightGrams: 1500,
    weightOptionsJson: "[1,2]",
    ingredients:
      "Innehåller alla tre kaksorterna – fullständig ingrediensförteckning per sort finns under Ingredienser & allergener.",
    allergens: "Innehåller vete, mandel, ägg, smör (mjölk). Kan innehålla spår av soja.",
    imageRef: "/images/prova-pa-paket.jpg",
    sortOrder: 4,
  },
];

// Leveransdagar per område: endast torsdag (4) just nu (verksamhetens
// uppgift, aug 2026) – ändras i admin -> Inställningar utan kodändring.
const areas = [
  { slug: "tyreso", name: "Tyresö", postalCodePrefixesJson: '["135"]', weekdaysJson: "[4]", sortOrder: 1 },
  { slug: "nacka", name: "Nacka", postalCodePrefixesJson: '["131", "132", "133", "138"]', weekdaysJson: "[4]", sortOrder: 2 },
  { slug: "haninge", name: "Haninge", postalCodePrefixesJson: '["136", "137"]', weekdaysJson: "[4]", sortOrder: 3 },
  { slug: "huddinge", name: "Huddinge", postalCodePrefixesJson: '["141", "142", "143"]', weekdaysJson: "[4]", sortOrder: 4 },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      // Livsmedelsmoms: tillfälligt 6 % 2026-04-01–2027-12-31 (riksdagsbeslut
      // 2025/26:SkU9), därefter 12 % igen – ändras i admin → Produkter.
      create: { weightOptionsJson: "[1,2,3]", vatRateBp: FOOD_VAT_RATE_BP, ...p },
      update: {}, // rör aldrig befintlig produktdata vid om-seed
    });
  }

  // Nummerserierna seedas explicit så att allra första ordern/fakturan inte
  // förlitar sig på upsert under samtidighet (numbering.ts).
  for (const [name, value] of [
    ["order", 100000],
    ["invoice", 10000],
    ["subscription", 1000],
  ] as const) {
    await prisma.counter.upsert({ where: { name }, create: { name, value }, update: {} });
  }

  // Postnummerprefix (postalCodePrefixesJson) är svensk postnummergeografi per
  // kommun: Tyresö 135, Nacka 131/132/133/138, Haninge 136/137, Huddinge
  // 141/142/143. Kassan avvisar postnummer utanför prefixen; verksamheten
  // justerar listan i admin → Inställningar (tomt = ingen spärr).
  for (const a of areas) {
    await prisma.deliveryArea.upsert({
      where: { slug: a.slug },
      create: { ...a, leadTimeDays: 2 },
      update: {},
    });
  }

  await prisma.deliveryOpsSettings.upsert({
    where: { id: "default" },
    create: { id: "default", cutoffWeekday: 3, cutoffHour: 12, opsEmail: "" },
    update: {},
  });

  // Startsaldo för lager: exempelvärden BARA i SQLite-demo. Produktion
  // (Neon) ska inte få påhittat fryssaldo.
  const sqliteDemo = (process.env.DATABASE_URL ?? "").startsWith("file:");
  const startStock: Record<string, { physicalGrams: number; minGrams: number }> = sqliteDemo
    ? {
        mandelkubb: { physicalGrams: 6000, minGrams: 4000 },
        kolasnittar: { physicalGrams: 10000, minGrams: 5000 },
        chokladsnittar: { physicalGrams: 4000, minGrams: 4000 },
        "prova-pa-paket": { physicalGrams: 9000, minGrams: 3000 },
      }
    : {};
  const seededProducts = await prisma.product.findMany({ select: { id: true, slug: true } });
  for (const p of seededProducts) {
    const stock = startStock[p.slug] ?? { physicalGrams: 0, minGrams: 0 };
    const inv = await prisma.inventory.upsert({
      where: { productId: p.id },
      create: { productId: p.id, ...stock },
      update: {},
    });
    const existingMovements = await prisma.inventoryMovement.count({ where: { inventoryId: inv.id } });
    if (existingMovements === 0 && stock.physicalGrams > 0) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          productId: p.id,
          kind: "ADJUSTMENT",
          gramsDelta: stock.physicalGrams,
          reason: "Ingående lagersaldo vid systemstart",
          actor: "system",
          beforeGrams: 0,
          afterGrams: stock.physicalGrams,
        },
      });
    }
  }

  // Folkets nästa småkaka, omgång 1: Hallongrotta, Dröm, Schackruta.
  // Deadline Luciadagen 13 december 2026 kl. 23:59 svensk tid (CET = UTC+1).
  // Idempotent: befintlig omgång rörs inte (rösterna får aldrig nollställas).
  const poll = await prisma.poll.upsert({
    where: { slug: "folkets-nasta-smakaka-1" },
    create: {
      slug: "folkets-nasta-smakaka-1",
      sequence: 1,
      title: "Vilken klassiker ska vi baka härnäst?",
      intro: "Vi vill väcka recepten ur Svenskt konditorlexikon till liv igen. Nu får ni bestämma vilken småkaka som blir nästa i Sockerbagarens sortiment.",
      deadlineLabel: "Luciadagen den 13 december",
      startsAt: new Date("2026-09-08T00:00:00.000Z"),
      endsAt: new Date("2026-12-13T22:59:59.000Z"),
      status: "ACTIVE",
    },
    update: {},
  });
  const candidates = [
    { slug: "hallongrotta", name: "Hallongrotta", displayOrder: 1, description: "Smörig mördeg med en grop hallonsylt i mitten.", tradition: "En av det svenska kakfatets stora klassiker – självskriven på kafferepet.", imageRef: "/images/hallongrotta.jpg" },
    { slug: "drom", name: "Dröm", displayOrder: 2, description: "Spröd och luftig, bakad med hjorthornssalt, smälter i munnen.", tradition: "Drömmar hör till de sju sorterna sedan generationer.", imageRef: "/images/drom.jpg" },
    { slug: "schackruta", name: "Schackruta", displayOrder: 3, description: "Tvåfärgad mördeg med vanilj och kakao, rutad som ett schackbräde.", tradition: "Kafferepets ögonfröjd – lika mycket hantverk som kaka.", imageRef: "/images/schackruta.jpg" },
  ];
  for (const c of candidates) {
    await prisma.pollCandidate.upsert({
      where: { pollId_slug: { pollId: poll.id, slug: c.slug } },
      create: { pollId: poll.id, ...c },
      // Kandidatfotot sätts vid om-seed; röster och texter rörs inte.
      update: { imageRef: c.imageRef },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminCount = await prisma.adminUser.count();
  // Exempelvärdena från .env.example får aldrig bli en riktig admin (Prisma
  // läser .env implicit även när DATABASE_URL pekar på produktion).
  const looksLikeExample =
    !adminEmail ||
    !adminPassword ||
    /example\.com$/i.test(adminEmail) ||
    /byt-mig|losenord/i.test(adminPassword) ||
    adminPassword.length < 12;
  if (adminCount === 0 && looksLikeExample && adminEmail) {
    console.warn("Seed: ADMIN_EMAIL/ADMIN_PASSWORD ser ut som exempelvärden – ingen admin skapad. Kör npm run admin:create med riktiga värden.");
  }
  if (adminCount === 0 && adminEmail && adminPassword && !looksLikeExample) {
    await prisma.adminUser.create({
      data: {
        email: adminEmail.toLowerCase(),
        name: "Admin",
        passwordHash: await hashPassword(adminPassword),
      },
    });
    console.log(`Adminanvändare skapad: ${adminEmail}`);
  }

  // Demo/preview (SQLite): tre tydligt fingerade bolag så lager- och
  // leveransvyn inte är tom. Aldrig i Neon-produktion.
  const sqlite = (process.env.DATABASE_URL ?? "").startsWith("file:");
  if (sqlite && (await prisma.order.count()) === 0) {
    const kol = await prisma.product.findUniqueOrThrow({ where: { slug: "kolasnittar" } });
    const man = await prisma.product.findUniqueOrThrow({ where: { slug: "mandelkubb" } });
    const cho = await prisma.product.findUniqueOrThrow({ where: { slug: "chokladsnittar" } });
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
    const first = upcomingDeliveryDates(
      { weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays },
      1
    )[0];
    if (first) {
      const date = toISODate(first);
      const base = {
        areaSlug: "tyreso",
        deliveryDate: date,
        phone: "070-000 00 00",
        deliveryAddress: "Radiovägen 1",
        deliveryPostalCode: "135 48",
        deliveryCity: "Tyresö",
        deliveryInstruction: "Lämna i receptionen.",
        reference: "",
        billingAddress: "",
      };
      await createSubscription({
        ...base,
        firstDeliveryDate: date,
        frequency: "WEEKLY",
        items: [{ productId: kol.id, weightKg: 2 }],
        companyName: "Kund A Fika AB",
        orgNumber: demoOrgNumber("556001111"),
        contactName: "Anna Andersson",
        email: "anna@kunda-fika.test",
        invoiceEmail: "faktura@kunda-fika.test",
        idempotencyKey: "seed-sub-kund-a-01",
      }).catch((e) => console.warn("Seed prenumeration Kund A:", e instanceof Error ? e.message : e));
      await generateDueSubscriptionOrders({ horizonDays: 14, skipEmails: true, now: new Date() });
      await createOrder(
        {
          ...base,
          items: [{ productId: man.id, weightKg: 3 }],
          companyName: "Kund B Kontor AB",
          orgNumber: demoOrgNumber("556002222"),
          contactName: "Bertil Berg",
          email: "bertil@kundb-kontor.test",
          invoiceEmail: "faktura@kundb-kontor.test",
          idempotencyKey: "seed-order-kund-b-01",
        },
        { skipEmails: true }
      ).catch((e) => console.warn("Seed order Kund B:", e instanceof Error ? e.message : e));
      await createOrder(
        {
          ...base,
          items: [{ productId: cho.id, weightKg: 1 }],
          companyName: "Kund C Bygg AB",
          orgNumber: demoOrgNumber("556003333"),
          contactName: "Cecilia Carlsson",
          email: "cecilia@kundc-bygg.test",
          invoiceEmail: "faktura@kundc-bygg.test",
          deliveryInstruction: "",
          idempotencyKey: "seed-order-kund-c-01",
        },
        { skipEmails: true }
      ).catch((e) => console.warn("Seed order Kund C:", e instanceof Error ? e.message : e));
      console.log(`Demo-ordrar seedade till ${date}.`);
    }
  }

  console.log("Seed klar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
