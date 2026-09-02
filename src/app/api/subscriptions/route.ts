import { NextRequest, NextResponse } from "next/server";
import { subscriptionSchema, fieldErrors } from "@/lib/validation";
import { createSubscription } from "@/lib/subscriptions/service";
import { prisma } from "@/lib/db";
import { calculateTotals } from "@/lib/money";
import { OrderError } from "@/lib/orders/create-order";
import { sendEmail } from "@/lib/email";
import { FREQUENCY_LABELS } from "@/lib/status";
import { formatDeliveryDate } from "@/lib/dates";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req.headers, "subscription"), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "För många försök — vänta en stund och försök igen" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Kontrollera uppgifterna", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const requestStartedAt = Date.now();
    const subscription = await createSubscription(parsed.data);
    // Idempotent replay (retry/dubbelklick) returnerar en redan skapad
    // prenumeration — då ska bekräftelsen inte mejlas en gång till.
    const isReplay = subscription.createdAt.getTime() < requestStartedAt - 2000;
    // Per-leverans-summa räknas på servern från databasens priser — aldrig klientens.
    const products = await prisma.product.findMany({
      where: { id: { in: subscription.items.map((i) => i.productId) } },
    });
    const totals = calculateTotals(
      subscription.items.map((i) => {
        const product = products.find((p) => p.id === i.productId);
        return { netOre: i.weightKg * (product?.pricePerKgOre ?? 0), vatRateBp: product?.vatRateBp ?? 1200 };
      })
    );

    // Bekräftelse — prenumerationen är sparad även om mejlet fallerar.
    if (!isReplay) await sendEmail({
      to: subscription.email,
      subject: `Fikaprenumeration ${subscription.number} startad — Sockerbagaren`,
      text: `Tack! Er fikaprenumeration är igång.

Prenumerationsnummer: ${subscription.number}
Intervall: ${FREQUENCY_LABELS[subscription.frequency as keyof typeof FREQUENCY_LABELS] ?? subscription.frequency}
Första leverans: ${formatDeliveryDate(subscription.nextDeliveryDate)}

Inför varje leverans skapas en vanlig order med faktura till ${subscription.invoiceEmail}.
Vill ni pausa, ändra eller avsluta? Svara på det här mejlet så ordnar vi det.

Vänliga hälsningar
Sockerbagaren`,
      type: "SUBSCRIPTION_CONFIRMATION",
    });

    return NextResponse.json({
      ok: true,
      subscriptionNumber: subscription.number,
      totalOre: totals.totalOre,
      nextDeliveryDate: subscription.nextDeliveryDate.toISOString().slice(0, 10),
    });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json(
        { ok: false, error: e.message, fields: e.field ? { [e.field]: e.message } : undefined },
        { status: 400 }
      );
    }
    const ref = Math.random().toString(36).slice(2, 10).toUpperCase();
    console.error(`Prenumerationsfel [ref ${ref}]:`, e);
    return NextResponse.json(
      {
        ok: false,
        error: `Prenumerationen kunde inte startas — ingenting har sparats. Försök igen om en liten stund. Referens: ${ref}`,
      },
      { status: 500 }
    );
  }
}
