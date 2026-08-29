// Körs en gång per serverstart (Next.js instrumentation, Node-runtime).
// Fail-fast-miljövalidering: saknad kritisk konfiguration ska synas direkt
// i loggarna vid boot — inte som slumpmässiga krascher under checkout.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkEnv } = await import("@/lib/env-check");
  const report = checkEnv();

  for (const name of report.missing) {
    console.error(`[env] KRITISKT: ${name} saknas — databasberoende sidor kommer att fela.`);
  }
  for (const warning of report.warnings) {
    console.warn(`[env] ${warning}`);
  }
  if (report.ok && report.warnings.length === 0) {
    console.log("[env] miljökonfiguration OK");
  }
}
