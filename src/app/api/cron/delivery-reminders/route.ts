import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { authorizeCron } from "@/lib/cron-auth";
import { sendDeliveryReminders } from "@/lib/orders/order-emails";
import { describeError } from "@/lib/log";

export const maxDuration = 60;

// Leveranspåminnelse dagen före (schema i vercel.json, eftermiddag svensk tid).
// Idempotent: e-postloggen håller reda på vilka ordrar som redan påmints.
async function runCron(req: NextRequest): Promise<NextResponse> {
  const denied = authorizeCron(req);
  if (denied) return denied;
  try {
    const result = await sendDeliveryReminders();
    console.log(`[cron] leveranspåminnelser: ${result.sent} skickade, ${result.skipped} redan påminda`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron] leveranspåminnelser misslyckades:", describeError(e));
    Sentry.captureException(e, { tags: { flow: "cron-reminders" } });
    return NextResponse.json({ ok: false, error: "Cron-körningen misslyckades" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}
