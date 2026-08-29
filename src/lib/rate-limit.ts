// Enkel in-memory rate limiting (glidande fönster). Räcker för en liten
// monolit på en instans — skyddar login, checkout och e-postutskick mot
// brute force och missbruk. Vid flera instanser behövs delad lagring.

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Städa gamla nycklar då och då så att minnet inte växer.
  if (now - lastSweep > 10 * 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (b.timestamps.every((t) => now - t > opts.windowMs)) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < opts.windowMs);
  if (bucket.timestamps.length >= opts.limit) {
    const oldest = Math.min(...bucket.timestamps);
    return { ok: false, retryAfterSeconds: Math.ceil((oldest + opts.windowMs - now) / 1000) };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfterSeconds: 0 };
}

export function clientKey(headers: Headers, scope: string): string {
  const fwd = headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "local";
  return `${scope}:${ip}`;
}
