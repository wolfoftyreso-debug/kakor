import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

// OBS: priserna nedan är START-/PLATSHÅLLARPRISER som verksamheten ska
// bekräfta eller ändra i admin (Produkter). Historiska ordrar påverkas inte.
const products = [
  {
    slug: "mandelkubb",
    name: "Mandelkubb",
    description:
      "Mör, mandeldoftande och rejäl — en tät svensk klassiker med gyllene, lätt knaprig yta och mjuk, smörig kärna. Generös med mandeln och med en rund sötma som gör sig perfekt till kaffet.",
    pricePerKgOre: 29500,
    ingredients:
      "Vetemjöl, smör, socker, mandel, ägg från frigående höns, bakpulver, keltiskt salt.",
    allergens: "Innehåller vete, mandel, ägg, smör (mjölk).",
    imageRef: "/images/mandelkubb.jpg",
    sortOrder: 1,
  },
  {
    slug: "kolasnittar",
    name: "Kolasnittar",
    description:
      "Vår överlägsna bästsäljare — nötig, med toner av brynt smör och knäck och en vuxen sälta. Härligt frasig klassisk småkaka med seg kärna och lätt smörfriterad botten.",
    pricePerKgOre: 29500,
    ingredients: "Vetemjöl, smör, socker, ljus sirap, vaniljsocker, bikarbonat, keltiskt salt.",
    allergens: "Innehåller vete, smör (mjölk).",
    imageRef: "/images/kolasnittar.jpg",
    sortOrder: 2,
  },
  {
    slug: "chokladsnittar",
    name: "Chokladsnittar",
    description:
      "Djup chokladkaraktär av mörk choklad och kakao — härligt frasiga snittar med seg kärna, rund sötma av ljus sirap och en fin sälta som lyfter chokladen.",
    pricePerKgOre: 29500,
    ingredients:
      "Vetemjöl, smör, socker, mörk choklad, kakao, ljus sirap, vaniljsocker, bakpulver, keltiskt salt.",
    allergens: "Innehåller vete, smör (mjölk). Kan innehålla spår av mandel.",
    imageRef: "/images/chokladsnittar.jpg",
    sortOrder: 3,
  },
  {
    // Styckvara: säljs per paket (pricePerKgOre = pris per paket).
    // Startpris = 1,5 kg × startpriset 295 kr/kg — bekräftas/ändras i admin.
    slug: "prova-pa-paket",
    name: "Prova-på-paket",
    description:
      "1,5 kg småkakor — 0,5 kg vardera av mandelkubb, kolasnittar och chokladsnittar. Hela sortimentet i en beställning: det enkla sättet att låta arbetsplatsen provsmaka och hitta sin favorit.",
    pricePerKgOre: 44250,
    unit: "paket",
    packageWeightGrams: 1500,
    weightOptionsJson: "[1,2]",
    ingredients:
      "Innehåller alla tre kaksorterna — se respektive sort ovan för fullständig ingrediensförteckning.",
    allergens: "Innehåller vete, mandel, ägg, smör (mjölk).",
    imageRef: "/images/prova-pa-paket.jpg",
    sortOrder: 4,
  },
];

// Leveransdagar per område: endast torsdag (4) just nu (verksamhetens
// uppgift, aug 2026) — ändras i admin -> Inställningar utan kodändring.
const areas = [
  { slug: "tyreso", name: "Tyresö", weekdaysJson: "[4]", sortOrder: 1 },
  { slug: "nacka", name: "Nacka", weekdaysJson: "[4]", sortOrder: 2 },
  { slug: "haninge", name: "Haninge", weekdaysJson: "[4]", sortOrder: 3 },
  { slug: "huddinge", name: "Huddinge", weekdaysJson: "[4]", sortOrder: 4 },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: { weightOptionsJson: "[1,2,3]", vatRateBp: 1200, ...p },
      update: {}, // rör aldrig befintlig produktdata vid om-seed
    });
  }

  for (const a of areas) {
    await prisma.deliveryArea.upsert({
      where: { slug: a.slug },
      create: { ...a, leadTimeDays: 2 },
      update: {},
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminCount = await prisma.adminUser.count();
  if (adminCount === 0 && adminEmail && adminPassword) {
    await prisma.adminUser.create({
      data: {
        email: adminEmail.toLowerCase(),
        name: "Admin",
        passwordHash: await hashPassword(adminPassword),
      },
    });
    console.log(`Adminanvändare skapad: ${adminEmail}`);
  }

  console.log("Seed klar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
