// Körs en gång per serverstart (Next.js instrumentation).
// TESTDEPLOY (Vercel-demo): när ingen DATABASE_URL är satt kopieras den
// byggda demodatabasen till /tmp så att serverless-funktionerna kan skriva.
// OBS: /tmp är per instans och nollställs vid kallstart — dokumenterad
// begränsning för testmiljön. Riktig drift sätter DATABASE_URL.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.VERCEL || process.env.DATABASE_URL) return;

  const fs = await import("node:fs");
  const path = await import("node:path");
  const target = "/tmp/sockerbagaren-demo.db";
  if (fs.existsSync(target)) return;
  const source = path.join(process.cwd(), "prisma", "demo.db");
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    console.log("[demo] demodatabas kopierad till /tmp");
  } else {
    console.error("[demo] prisma/demo.db saknas i bundlen — kör build:demo");
  }
}
