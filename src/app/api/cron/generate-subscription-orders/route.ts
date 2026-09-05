import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { pruneEmailLogs } from "@/lib/email";
import { describeError } from "@/lib/log";
import { sweepRateLimitBuckets } from "@/lib/rate-limit";

// Vercel: PDF-rendering + mejl kan ta tid — standard 10 s räcker inte på kalla starter.
export const maxDuration = 60;

// Prenumerations-cron. Körs av Vercel Cron (GET, schema i vercel.json) —
// Vercel skickar automatiskt "Authorization: Bearer <CRON_SECRET>" när
// CRON_SECRET finns som env-variabel i projektet. POST behålls för manuell
// körning/CLI. Motorn är idempotent: unikhetsvillkoret
// (subscriptionId, subscriptionPeriod) i Postgres gör dubbla/överlappande
// körningar ofarliga.

async function runCron(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET är inte konfigurerad" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  // Hash före jämförelsen: konstant längd => timingSafeEqual utan tidig avbrytning.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(auth), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ ok: false, error: "Obehörig" }, { status: 401 });
  }
  // Städning först och oberoende av generatorn — kastar generatorn ska
  // rate limit-tabellen och e-postloggen ändå inte växa.
  const swept = await sweepRateLimitBuckets().catch(() => 0);
  const prunedEmailLogs = await pruneEmailLogs().catch(() => 0);
  try {
    const result = await generateDueSubscriptionOrders();
    console.log(
      `[cron] prenumerationsgenerering: ${result.generated.length} genererade, ${result.skipped.length} överhoppade`
    );
    return NextResponse.json({ ok: true, ...result, sweptRateLimitBuckets: swept, prunedEmailLogs });
  } catch (e) {
    console.error("[cron] prenumerationsgenerering misslyckades:", describeError(e));
    Sentry.captureException(e, { tags: { flow: "cron" } });
    return NextResponse.json({ ok: false, error: "Cron-körningen misslyckades" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}
