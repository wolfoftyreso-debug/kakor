// Första beröringen i sessionen: var landade besökaren, och varifrån.
// Ingen URL, inget namn, ingen e-post – bara grova klasser för organisk mätning.

export const ACQ_PATH_KEY = "sb_acq_path";
export const ACQ_SOURCE_KEY = "sb_acq_source";

export type LandingCluster =
  | "branded"
  | "local"
  | "product"
  | "subscription"
  | "info"
  | "transactional"
  | "other";

export type SourceClass = "google" | "bing" | "internal" | "none" | "external" | "unknown";

export function landingCluster(path: string): LandingCluster {
  const p = (path.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (p === "/" || p === "/om") return "branded";
  if (/^\/(tyreso|nacka|haninge|huddinge)$/.test(p)) return "local";
  if (p.startsWith("/kakor")) return "product";
  if (p.startsWith("/prenumeration")) return "subscription";
  if (
    p === "/fika-till-jobbet" ||
    p === "/julfika" ||
    p === "/vanliga-fragor" ||
    p === "/ingredienser" ||
    p === "/leverans" ||
    p === "/folkets-kaka"
  ) {
    return "info";
  }
  if (p.startsWith("/bestall")) return "transactional";
  return "other";
}

export function classifySource(input: { referrer: string; href: string; selfHost: string }): SourceClass {
  try {
    const utm = new URL(input.href).searchParams.get("utm_source")?.toLowerCase() ?? "";
    if (utm.includes("google")) return "google";
    if (utm.includes("bing")) return "bing";
    if (!input.referrer) return "none";
    const host = new URL(input.referrer).hostname;
    if (host === input.selfHost) return "internal";
    if (/(^|\.)google\./.test(host)) return "google";
    if (/(^|\.)bing\./.test(host)) return "bing";
    return "external";
  } catch {
    return "unknown";
  }
}

export function captureAcquisition(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(ACQ_PATH_KEY)) return;
    sessionStorage.setItem(ACQ_PATH_KEY, window.location.pathname || "/");
    sessionStorage.setItem(
      ACQ_SOURCE_KEY,
      classifySource({
        referrer: document.referrer,
        href: window.location.href,
        selfHost: window.location.hostname,
      })
    );
  } catch {
    // Privat läge / blockerad storage – mätning får aldrig fälla sajten.
  }
}

export function readAcquisition(): { source_class?: string; landing_cluster?: string } {
  if (typeof window === "undefined") return {};
  try {
    const path = sessionStorage.getItem(ACQ_PATH_KEY);
    const source = sessionStorage.getItem(ACQ_SOURCE_KEY);
    if (!path && !source) return {};
    return {
      ...(source ? { source_class: source } : {}),
      ...(path ? { landing_cluster: landingCluster(path) } : {}),
    };
  } catch {
    return {};
  }
}
