import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// Gemensam auth för cron-endpoints. Vercel Cron skickar automatiskt
// "Authorization: Bearer <CRON_SECRET>" när variabeln finns i projektet.
// Returnerar ett felsvar, eller null när anropet är behörigt.
export function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET är inte konfigurerad" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  // Hash före jämförelsen: konstant längd => timingSafeEqual utan tidig avbrytning.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(auth), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ ok: false, error: "Obehörig" }, { status: 401 });
  }
  return null;
}
