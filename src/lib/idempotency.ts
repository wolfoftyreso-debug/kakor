// Klientgenererad idempotensnyckel för checkout/prenumerationsstart.
// Nyckeln ska vara ogissbar — svaret på en återanvänd nyckel innehåller
// orderdata — så fallbackkedjan går via kryptografisk slump.
export function newIdempotencyKey(): string {
  const c = typeof crypto !== "undefined" ? (crypto as Partial<Crypto>) : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12).padEnd(10, "0")}`;
}
