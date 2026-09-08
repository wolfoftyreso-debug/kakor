import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPollBySlug, signupForWinner } from "@/lib/polls/service";
import { sameOrigin } from "@/lib/polls/visitor";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log";

const bodySchema = z.strictObject({ email: z.string().trim().email("Ange en giltig e-postadress").max(200) });

// Frivillig avisering när vinnaren går att beställa. Aldrig ett villkor för att rösta.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Ogiltig förfrågan" }, { status: 403 });
  const limit = await rateLimit(clientKey(req.headers, "poll-signup"), { limit: 5, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ ok: false, error: "För många försök – vänta en stund" }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Ange en giltig e-postadress" }, { status: 400 });
  const poll = await getPollBySlug(slug);
  if (!poll || poll.status === "DRAFT") return NextResponse.json({ ok: false, error: "Omröstningen finns inte" }, { status: 404 });
  try {
    await signupForWinner(poll.id, parsed.data.email);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("Aviseringsfel:", describeError(e));
    return NextResponse.json({ ok: false, error: "Kunde inte spara just nu – försök igen om en stund." }, { status: 500 });
  }
}
