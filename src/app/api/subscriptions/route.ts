import { NextRequest, NextResponse } from "next/server";
import { subscriptionSchema, fieldErrors } from "@/lib/validation";
import { createSubscription } from "@/lib/subscriptions/service";
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
    const subscription = await createSubscription(parsed.data);

    // Bekräftelse — prenumerationen är sparad även om mejlet fallerar.
    await sendEmail({
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
      nextDeliveryDate: subscription.nextDeliveryDate.toISOString().slice(0, 10),
    });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json(
        { ok: false, error: e.message, fields: e.field ? { [e.field]: e.message } : undefined },
        { status: 400 }
      );
    }
    console.error("Prenumerationsfel:", e);
    return NextResponse.json(
      { ok: false, error: "Något gick fel — försök igen eller kontakta oss" },
      { status: 500 }
    );
  }
}
