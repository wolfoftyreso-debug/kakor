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
  const invoice = await prisma.invoice.findUnique({ where: { downloadToken: token } });
  if (!invoice) return new NextResponse("Fakturan hittades inte", { status: 404 });

  const snapshot = parseSnapshot(invoice.snapshotJson);
  const pdf = await renderInvoicePdf(snapshot, invoice.invoiceNumber);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="faktura-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
