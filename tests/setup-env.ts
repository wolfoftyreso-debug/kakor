// Körs före varje testfil. DATABASE_URL sätts av global-setup (inbäddad
// PostgreSQL) — här säkras bara övrig testmiljö.
process.env.EMAIL_PROVIDER = "log";
process.env.SITE_URL = "http://localhost:3000";
process.env.POLL_IP_SALT ??= "test-poll-salt";
if (!process.env.DATABASE_URL?.includes("sockerbagaren_test")) {
  throw new Error("Testerna måste köras via vitest (global-setup startar testdatabasen).");
}
