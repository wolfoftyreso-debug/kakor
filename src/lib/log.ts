// Loggning utan personuppgifter: Prismas valideringsfel bäddar in hela
// anropets args (kunddata) i meddelandet — logga därför bara namn, kod och
// ett avkortat meddelande.
export function describeError(e: unknown): Record<string, unknown> | string {
  if (e instanceof Error) {
    const code = (e as { code?: unknown }).code;
    return { name: e.name, code, message: e.message.slice(0, 300) };
  }
  return String(e).slice(0, 300);
}

/** Maskar en e-postadress för loggning: "k***@domän.se". */
export function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return "***";
  return `${address[0]}***${address.slice(at)}`;
}
