import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";

// Säker fakturanedladdning: 48 tecken slumpad token, ingen inloggning krävs.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return new NextResponse("Ogiltig länk", { status: 404 });
  }
  // Samma länkformat för faktura och kreditfaktura (egna token-serier).
  const invoice = await prisma.invoice.findUnique({ where: { downloadToken: token } });
  const credit = invoice ? null : await prisma.creditNote.findUnique({ where: { downloadToken: token } });
  const doc = invoice
    ? { snapshotJson: invoice.snapshotJson, number: invoice.invoiceNumber, filename: `faktura-${invoice.invoiceNumber}.pdf` }
    : credit
      ? { snapshotJson: credit.snapshotJson, number: credit.creditNumber, filename: `kreditfaktura-${credit.creditNumber}.pdf` }
      : null;
  if (!doc) return new NextResponse("Fakturan hittades inte", { status: 404 });

  const snapshot = parseSnapshot(doc.snapshotJson);
  const pdf = await renderInvoicePdf(snapshot, doc.number);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
