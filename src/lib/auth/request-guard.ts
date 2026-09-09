// GET-nedladdningar som bär admin-sessionen (CSV, PDF) får inte köras som
// cross-site navigation: SameSite=Lax skickar kakan vid klick från en
// främmande sida. Sec-Fetch-Site är standard 2026; Referer är fallback.

export function isFirstPartyNavigation(headers: Headers): boolean {
  const site = (headers.get("sec-fetch-site") ?? "").toLowerCase();
  if (site === "cross-site" || site === "same-site") return false;
  if (site === "same-origin" || site === "none") return true;
  const referer = headers.get("referer");
  if (!referer) return true;
  try {
    const host = headers.get("host");
    if (!host) return false;
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}
