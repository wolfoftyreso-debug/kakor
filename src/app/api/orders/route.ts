import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { checkoutSchema, fieldErrors } from "@/lib/validation";
import { createOrder, OrderError } from "@/lib/orders/create-order";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log";
import { clientIp, verifyTurnstile } from "@/lib/turnstile";

// Vercel: PDF-rendering + mejl kan ta tid — standard 10 s räcker inte på kalla starter.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Minutfönster mot burst + dygnsfönster mot långsam fakturagenerering från
  // en och samma adress (löpnumrerade fakturor mejlas till valfri mottagare).
  const limit = await rateLimit(clientKey(req.headers, "checkout"), { limit: 10, windowMs: 60_000 });
  const daily = limit.ok ? await rateLimit(clientKey(req.headers, "checkout-dygn"), { limit: 40, windowMs: 24 * 3600_000 }) : limit;
  if (!limit.ok || !daily.ok) {
    return NextResponse.json(
      { ok: false, error: "För många försök — vänta en stund och försök igen" },
      { status: 429, headers: { "Retry-After": String(limit.ok ? daily.retryAfterSeconds : limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Kontrollera uppgifterna", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  // Robotskydd (Cloudflare Turnstile) — no-op utan nycklar.
  const captcha = await verifyTurnstile(parsed.data.turnstileToken, clientIp(req.headers));
  if (!captcha.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Robotkontrollen gick inte igenom — försök igen.",
        code: "CAPTCHA_FAILED",
        fields: { turnstileToken: "Bekräfta att ni inte är en robot" },
      },
      { status: 400 }
    );
  }

  try {
    const { order, invoice } = await createOrder(parsed.data);
    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      invoiceNumber: invoice.invoiceNumber,
      invoiceUrl: `/faktura/${invoice.downloadToken}`,
      deliveryDate: order.deliveryDate.toISOString().slice(0, 10),
      totalOre: order.totalOre,
    });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json(
        { ok: false, error: e.message, code: e.code, fields: e.field ? { [e.field]: e.message } : undefined },
        { status: e.code === "IDEMPOTENCY_MISMATCH" || e.code === "PRICE_CHANGED" ? 409 : e.code === "TOO_MANY" ? 429 : e.code === "INVOICING_NOT_CONFIGURED" ? 503 : 400 }
      );
    }
    // Felreferens: gör produktionsfel sökbara i Vercel-loggarna utan att
    // exponera stack traces för kunden. Ordern har INTE skapats här.
    const ref = Math.random().toString(36).slice(2, 10).toUpperCase();
    console.error(`Orderfel [ref ${ref}]:`, describeError(e));
    Sentry.captureException(e, { tags: { flow: "checkout", ref } });
    return NextResponse.json(
      {
        ok: false,
        error: `Beställningen kunde inte genomföras — ingen order har skapats. Försök igen om en liten stund. Referens: ${ref}`,
      },
      { status: 500 }
    );
  }
}
