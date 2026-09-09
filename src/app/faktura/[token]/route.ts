import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { formatOre } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Säker fakturanedladdning: 48 tecken slumpad token, ingen inloggning krävs.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limit = await rateLimit(clientKey(_req.headers, "faktura"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return new NextResponse("För många försök – vänta en stund", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "private, no-store" },
    });
  }
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return NextResponse.redirect(new URL("/faktura-saknas", _req.url), 302);
  }
  // Samma länkformat för faktura och kreditfaktura (egna token-serier).
  const invoice = await prisma.invoice.findUnique({ where: { downloadToken: token }, include: { creditNotes: { orderBy: { createdAt: "asc" } } } });
  const credit = invoice ? null : await prisma.creditNote.findUnique({ where: { downloadToken: token } });
  // En faktura som hämtas efter kreditering ska bära det på dokumentet – annars
  // ser en krediterad faktura fullt betalbar ut i mottagarens arkiv.
  let statusNote: string | undefined;
  if (invoice && invoice.creditNotes.length > 0) {
    const credited = invoice.creditNotes.reduce((s, c) => s + c.totalOre, 0); // negativt
    const numbers = invoice.creditNotes.map((c) => c.creditNumber).join(", ");
    const last = invoice.creditNotes[invoice.creditNotes.length - 1];
    statusNote =
      invoice.status === "CREDITED"
        ? `Krediterad ${toISODate(last.createdAt)} genom kreditfaktura ${numbers} – ska inte betalas`
        : `Delvis krediterad (kreditfaktura ${numbers}) – återstår ${formatOre(Math.max(0, invoice.totalOre + credited)).replace(/[\u202f\u00a0]/g, " ")}`;
  } else if (invoice && invoice.status === "PAID") {
    statusNote = "Betald";
  }
  const doc = invoice
    ? { snapshotJson: invoice.snapshotJson, number: invoice.invoiceNumber, filename: `faktura-${invoice.invoiceNumber}.pdf` }
    : credit
      ? { snapshotJson: credit.snapshotJson, number: credit.creditNumber, filename: `kreditfaktura-${credit.creditNumber}.pdf` }
      : null;
  if (!doc) return NextResponse.redirect(new URL("/faktura-saknas", _req.url), 302);

  const snapshot = parseSnapshot(doc.snapshotJson);
  const pdf = await renderInvoicePdf(snapshot, doc.number, { statusNote });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
