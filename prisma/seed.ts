import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

// OBS: priserna nedan är START-/PLATSHÅLLARPRISER som verksamheten ska
// bekräfta eller ändra i admin (Produkter). Historiska ordrar påverkas inte.
const products = [
  {
    slug: "mandelkubb",
    name: "Mandelkubb",
    description: "Klassisk svensk mandelkubb — mör, mandeldoftande och rejäl.",
    pricePerKgOre: 29500,
    ingredients:
      "Vetemjöl, smör, socker, mandel, ägg, bakpulver, salt.",
    allergens: "Innehåller vete, mandel, ägg, smör (mjölk).",
    imageRef: "/images/mandelkubb.jpg",
    sortOrder: 1,
  },
  {
    slug: "kolasnittar",
    name: "Kolasnittar",
    description: "Spröda, smöriga och precis lagom sega.",
    pricePerKgOre: 29500,
    ingredients: "Vetemjöl, smör, socker, ljus sirap, vaniljsocker, bikarbonat, salt.",
    allergens: "Innehåller vete, smör (mjölk).",
    imageRef: "/images/kolasnittar.jpg",
    sortOrder: 2,
  },
  {
    slug: "chokladsnittar",
    name: "Chokladsnittar",
    description: "Klassiska snittar med ordentlig chokladkaraktär.",
    pricePerKgOre: 29500,
    ingredients:
      "Vetemjöl, smör, socker, mörk choklad, kakao, ljus sirap, vaniljsocker, bakpulver, salt.",
    allergens: "Innehåller vete, smör (mjölk). Kan innehålla spår av mandel.",
    imageRef: "/images/chokladsnittar.jpg",
    sortOrder: 3,
  },
];

// Leveransdagar per område: tisdag (2) och torsdag (4) som start —
// ändras i databasen utan kodändring.
const areas = [
  { slug: "tyreso", name: "Tyresö", weekdaysJson: "[2,4]", sortOrder: 1 },
  { slug: "nacka", name: "Nacka", weekdaysJson: "[2,4]", sortOrder: 2 },
  { slug: "haninge", name: "Haninge", weekdaysJson: "[2,4]", sortOrder: 3 },
  { slug: "huddinge", name: "Huddinge", weekdaysJson: "[2,4]", sortOrder: 4 },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: { ...p, weightOptionsJson: "[1,2,3]", vatRateBp: 1200 },
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
