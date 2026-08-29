// Körs före varje testfil: pekar Prisma mot testdatabasen.
process.env.DATABASE_URL = "file:./test.db";
process.env.EMAIL_PROVIDER = "log";
process.env.SITE_URL = "http://localhost:3000";
