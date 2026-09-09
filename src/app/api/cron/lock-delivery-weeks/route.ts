import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { authorizeCron } from "@/lib/cron-auth";
import { lockDueDeliveryWeeks } from "@/lib/warehouse/lock";
import { describeError } from "@/lib/log";

export const maxDuration = 60;

// Låser leveransdagar vars cutoff passerat. Prenumerationer materialiseras
// först. Idempotent: redan låsta dagar och redan skickade mejl hoppas över.

async function runCron(req: NextRequest): Promise<NextResponse> {
  const denied = authorizeCron(req);
  if (denied) return denied;
  try {
    const result = await lockDueDeliveryWeeks();
    const locked = result.locks.filter((l) => !l.alreadyLocked && !l.error).length;
    const errors = result.locks.filter((l) => l.error);
    console.log(
      `[cron] leveranslåsning: ${result.generated} prenumerationsordrar, ${locked} nya lås, ${result.locks.length - locked} redan låsta/överhoppade`
    );
    return NextResponse.json({ ok: errors.length === 0 && !result.generateError, ...result });
  } catch (e) {
    console.error("[cron] leveranslåsning misslyckades:", describeError(e));
    Sentry.captureException(e, { tags: { flow: "cron-lock-weeks" } });
    return NextResponse.json({ ok: false, error: "Cron-körningen misslyckades" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}
