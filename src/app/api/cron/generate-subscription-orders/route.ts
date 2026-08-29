import { NextRequest, NextResponse } from "next/server";
import { generateDueSubscriptionOrders } from "@/lib/subscriptions/service";

// Cron-endpoint för prenumerationsgenerering. Idempotent — dubbla körningar
// kan aldrig skapa dubbla ordrar (unikhetsvillkor i databasen).
// Skyddas med CRON_SECRET (Authorization: Bearer <secret>).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET är inte konfigurerad" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Obehörig" }, { status: 401 });
  }
  const result = await generateDueSubscriptionOrders();
  return NextResponse.json({ ok: true, ...result });
}
