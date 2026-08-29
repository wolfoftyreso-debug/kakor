import { NextRequest, NextResponse } from "next/server";
import { checkoutSchema, fieldErrors } from "@/lib/validation";
import { createOrder, OrderError } from "@/lib/orders/create-order";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req.headers, "checkout"), { limit: 10, windowMs: 60_000 });
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

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Kontrollera uppgifterna", fields: fieldErrors(parsed.error) },
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
        { ok: false, error: e.message, fields: e.field ? { [e.field]: e.message } : undefined },
        { status: 400 }
      );
    }
    console.error("Orderfel:", e);
    return NextResponse.json(
      { ok: false, error: "Något gick fel — försök igen eller kontakta oss" },
      { status: 500 }
    );
  }
}
