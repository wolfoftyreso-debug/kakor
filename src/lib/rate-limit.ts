import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Rate limiting i två lager:
//  1) In-memory glidande fönster — snabbt, stoppar burstar inom en instans.
//  2) Delad räknare i databasen (RateLimitBucket, fast fönster) — håller över
//     serverless-instanser och cold starts, där minnesräknaren nollställs.
// Databasfel får aldrig blockera en kund: då gäller enbart minneslagret.

interface Bucket {
  timestamps: number[];
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/** Synkront minneslager (används av det delade lagret som första spärr). */
export function rateLimitMemory(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();

  // Städa gamla nycklar då och då — varje bucket bedöms mot SITT eget
  // fönster, så ett kort checkout-fönster sopar aldrig bort login-buckets.
  if (now - lastSweep > 10 * 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (b.timestamps.every((t) => now - t > b.windowMs)) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key) ?? { timestamps: [], windowMs: opts.windowMs };
  bucket.windowMs = opts.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < opts.windowMs);
  if (bucket.timestamps.length >= opts.limit) {
    const oldest = Math.min(...bucket.timestamps);
    return { ok: false, retryAfterSeconds: Math.ceil((oldest + opts.windowMs - now) / 1000) };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Delad räknare: atomisk increment i databasen inom ett fast fönster.
 * Returnerar ok=false när fönstrets gräns nåtts.
 */
export async function rateLimitShared(key: string, opts: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  const now = new Date();
  try {
    // Aktivt fönster: räkna upp atomiskt.
    const bumped = await prisma.rateLimitBucket.updateMany({
      where: { key, resetAt: { gt: now } },
      data: { count: { increment: 1 } },
    });
    if (bumped.count === 0) {
      // Inget aktivt fönster: starta ett nytt. Varje steg är en villkorad
      // enskild sats, så parallella anrop kan aldrig nollställa ett fönster
      // som en annan just startat — förloraren räknar upp i vinnarens fönster.
      const resetAt = new Date(now.getTime() + opts.windowMs);
      let started = false;
      try {
        await prisma.rateLimitBucket.create({ data: { key, count: 1, resetAt } });
        started = true;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
      if (!started) {
        // Raden finns: ta över den bara om fönstret är UTGÅNGET.
        const takeover = await prisma.rateLimitBucket.updateMany({
          where: { key, resetAt: { lte: now } },
          data: { count: 1, resetAt },
        });
        if (takeover.count === 1) started = true;
      }
      if (started) return { ok: true, retryAfterSeconds: 0 };
      // Någon annan hann starta fönstret — räkna upp i det och kontrollera taket.
      await prisma.rateLimitBucket.updateMany({ where: { key, resetAt: { gt: now } }, data: { count: { increment: 1 } } });
    }
    // Räknaren läses efter uppräkningen. Under extrem samtidighet (många anrop
    // i samma millisekund) kan den redan innehålla senare anrops steg — då
    // stängs hellre ett anrop för mycket än ett för lite (fail-closed).
    const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
    if (!bucket) return { ok: true, retryAfterSeconds: 0 };
    if (bucket.count > opts.limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)),
      };
    }
    return { ok: true, retryAfterSeconds: 0 };
  } catch (e) {
    console.error("[rate-limit] delad räknare otillgänglig — minneslagret gäller:", e instanceof Error ? e.message : e);
    return { ok: true, retryAfterSeconds: 0 };
  }
}

/** Kombinerad spärr: minneslager först, sedan den delade räknaren. */
export async function rateLimit(key: string, opts: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  const local = rateLimitMemory(key, opts);
  if (!local.ok) return local;
  return rateLimitShared(key, opts);
}

/** Städar utgångna räknare — anropas från prenumerations-cronen. */
export async function sweepRateLimitBuckets(): Promise<number> {
  const res = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return res.count;
}

export function clientKey(headers: Headers, scope: string): string {
  // På Vercel skriver plattformens proxy över x-forwarded-for med klientens
  // riktiga IP (kan inte spoofas). Vid self-hosting: sätt bara headern bakom
  // en betrodd proxy, annars delar alla nyckeln "local".
  const fwd = headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "local";
  return `${scope}:${ip}`;
}
