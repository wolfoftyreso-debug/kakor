// Skapar/uppdaterar en adminanvändare kontrollerat (ingen publik registrering).
// Användning: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Sätt ADMIN_EMAIL och ADMIN_PASSWORD i miljön.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Lösenordet måste vara minst 10 tecken.");
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, name: "Admin" },
    update: { passwordHash, sessions: { deleteMany: {} } }, // lösenordsbyte loggar ut alla sessioner
  });
  console.log(`Admin ${email} skapad/uppdaterad.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
