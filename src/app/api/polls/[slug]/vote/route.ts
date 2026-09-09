import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { castVote, hashIp, newVisitorId, PollError } from "@/lib/polls/service";
import { readVisitorId, sameOrigin, visitorCookieOptions, VISITOR_COOKIE } from "@/lib/polls/visitor";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/turnstile";
import { describeError } from "@/lib/log";

const bodySchema = z.strictObject({ candidateId: z.string().cuid() });

// En röst per besökare och omgång. Servern avgör om omgången är öppen, sätter
// besökskakan och räknar resultatet – klienten skickar bara kandidat-id.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Ogiltig förfrågan" }, { status: 403 });
  const minute = await rateLimit(clientKey(req.headers, "poll"), { limit: 10, windowMs: 60_000 });
  const day = minute.ok ? await rateLimit(clientKey(req.headers, "poll-dygn"), { limit: 40, windowMs: 24 * 3600_000 }) : minute;
  if (!minute.ok || !day.ok) {
    return NextResponse.json({ ok: false, error: "För många försök – vänta en stund och försök igen" }, { status: 429, headers: { "Retry-After": String((minute.ok ? day : minute).retryAfterSeconds) } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Välj en av kandidaterna" }, { status: 400 });

  const existingVisitor = readVisitorId(req);
  const visitorId = existingVisitor ?? newVisitorId();
  try {
    const outcome = await castVote({ slug, candidateId: parsed.data.candidateId, visitorId, ipHash: hashIp(clientIp(req.headers) ?? "local") });
    const res = NextResponse.json({ ok: true, already: outcome.already, candidateId: outcome.candidateId, results: outcome.results });
    if (!existingVisitor) {
      res.cookies.set(VISITOR_COOKIE, visitorId, visitorCookieOptions());
    }
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    if (e instanceof PollError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "BAD_CANDIDATE" ? 400 : 409;
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status });
    }
    console.error("Röstningsfel:", describeError(e));
    return NextResponse.json({ ok: false, error: "Rösten kunde inte registreras just nu – försök igen om en stund." }, { status: 500 });
  }
}
