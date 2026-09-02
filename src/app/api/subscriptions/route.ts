import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { subscriptionSchema, fieldErrors } from "@/lib/validation";
import { createSubscription } from "@/lib/subscriptions/service";
import { prisma } from "@/lib/db";
import { calculateTotals } from "@/lib/money";
import { OrderError } from "@/lib/orders/create-order";
import { sendEmail } from "@/lib/email";
import { FREQUENCY_LABELS } from "@/lib/status";
import { formatDeliveryDate } from "@/lib/dates";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log";
import { formatOre } from "@/lib/money";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(clientKey(req.headers, "subscription"), { limit: 10, windowMs: 60_000 });
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
    // Per-leverans-summa räknas på servern från databasens priser — aldrig
    // klientens. Räknas FÖRE skapandet så att en prisändring under tiden
    // avvisas utan att någon prenumeration hinner sparas.
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.items.map((i) => i.productId) }, active: true },
    });
    if (products.length !== new Set(parsed.data.items.map((i) => i.productId)).size) {
      throw new OrderError("En produkt i prenumerationen finns inte längre", "items");
    }
    const totals = calculateTotals(
      parsed.data.items.map((i) => {
        const product = products.find((p) => p.id === i.productId);
        return { netOre: i.weightKg * (product?.pricePerKgOre ?? 0), vatRateBp: product?.vatRateBp ?? 1200 };
      })
    );
    if (parsed.data.expectedTotalOre !== undefined && parsed.data.expectedTotalOre !== totals.totalOre) {
      throw new OrderError(
        "Priset har uppdaterats sedan ni började beställa — kontrollera den nya summan och skicka igen.",
        undefined,
        "PRICE_CHANGED"
      );
    }

    // Idempotent replay (retry/dubbelklick) returnerar en redan skapad
    // prenumeration — då ska bekräftelsen inte mejlas en gång till.
    const { subscription, duplicate: isReplay } = await createSubscription(parsed.data);

    // Bekräftelse — prenumerationen är sparad även om mejlet fallerar.
    if (!isReplay) {
      await sendEmail({
        to: subscription.email,
        subject: `Fikaprenumeration ${subscription.number} startad — Sockerbagaren`,
        text: `Tack! Er fikaprenumeration är igång.

Prenumerationsnummer: ${subscription.number}
Intervall: ${FREQUENCY_LABELS[subscription.frequency as keyof typeof FREQUENCY_LABELS] ?? subscription.frequency}
Första leverans: ${formatDeliveryDate(subscription.nextDeliveryDate)}
Leveransadress: ${subscription.deliveryAddress}, ${subscription.deliveryPostalCode} ${subscription.deliveryCity}
Belopp per leverans: ${formatOre(totals.totalOre)} inkl. moms (${formatOre(totals.subtotalOre)} exkl. moms)

Inför varje leverans skapas en vanlig order med faktura till ${subscription.invoiceEmail}.
Vill ni pausa, ändra eller avsluta? Svara på det här mejlet så ordnar vi det.

Vänliga hälsningar
Sockerbagaren`,
        type: "SUBSCRIPTION_CONFIRMATION",
      });
    }

    return NextResponse.json({
      ok: true,
      subscriptionNumber: subscription.number,
      totalOre: totals.totalOre,
      nextDeliveryDate: subscription.nextDeliveryDate.toISOString().slice(0, 10),
    });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json(
        { ok: false, error: e.message, code: e.code, fields: e.field ? { [e.field]: e.message } : undefined },
        { status: e.code === "IDEMPOTENCY_MISMATCH" || e.code === "PRICE_CHANGED" ? 409 : e.code === "TOO_MANY" ? 429 : e.code === "INVOICING_NOT_CONFIGURED" ? 503 : 400 }
      );
    }
    const ref = Math.random().toString(36).slice(2, 10).toUpperCase();
    console.error(`Prenumerationsfel [ref ${ref}]:`, describeError(e));
    Sentry.captureException(e, { tags: { flow: "subscription", ref } });
    return NextResponse.json(
      {
        ok: false,
        error: `Prenumerationen kunde inte startas — ingenting har sparats. Försök igen om en liten stund. Referens: ${ref}`,
      },
      { status: 500 }
    );
  }
}
