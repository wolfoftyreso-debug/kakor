import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { parseSnapshot, type InvoiceSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { sendEmail } from "@/lib/email";
import { formatOre } from "@/lib/money";
import { todayInStockholm, toISODate } from "@/lib/dates";

// Kreditfaktura när en fakturerad order avbryts. Nummer ur samma obrutna
// fakturaserie, eget snapshot (originalets rader + referens till fakturan),
// egen nedladdningslänk. Originalfakturan markeras CREDITED — aldrig raderad.
// Idempotent: finns kreditfakturan redan returneras den.

export async function issueCreditNote(invoiceId: string, actor: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { creditNote: true, order: true },
  });
  if (!invoice) return null;
  if (invoice.creditNote) return invoice.creditNote;

  const original = parseSnapshot(invoice.snapshotJson);
  const today = todayInStockholm();
  const snapshot: InvoiceSnapshot = {
    ...original,
    invoiceDate: toISODate(today),
    dueDate: toISODate(today),
    paymentTermsDays: 0,
    creditsInvoiceNumber: invoice.invoiceNumber,
  };

  const credit = await prisma.$transaction(async (tx) => {
    const creditNumber = await nextNumber(tx, "invoice");
    const created = await tx.creditNote.create({
      data: {
        creditNumber,
        invoiceId: invoice.id,
        issuedDate: today,
        snapshotJson: JSON.stringify(snapshot),
        subtotalOre: -invoice.subtotalOre,
        vatOre: -invoice.vatOre,
        totalOre: -invoice.totalOre,
        downloadToken: randomBytes(24).toString("hex"),
      },
    });
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CREDITED" } });
    await tx.orderEvent.create({
      data: {
        orderId: invoice.orderId,
        type: "CREDITED",
        message: `Kreditfaktura ${creditNumber} utfärdad — krediterar faktura ${invoice.invoiceNumber} (${formatOre(invoice.totalOre)}).`,
        actor,
      },
    });
    return created;
  });

  // Mejl efter commit — misslyckat mejl påverkar aldrig krediteringen.
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const pdf = await renderInvoicePdf(snapshot, credit.creditNumber);
    attachments = [{ filename: `kreditfaktura-${credit.creditNumber}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch (e) {
    console.error("Kreditfaktura-PDF misslyckades:", e instanceof Error ? e.message : e);
  }
  await sendEmail({
    to: invoice.order.invoiceEmail,
    subject: `Kreditfaktura ${credit.creditNumber} — Sockerbagaren`,
    text: `Order ${invoice.order.orderNumber} har avbrutits och faktura ${invoice.invoiceNumber} krediteras i sin helhet.

Kreditfaktura: ${credit.creditNumber}
Krediterat belopp: ${formatOre(invoice.totalOre)} inkl. moms

Fakturan ska inte betalas. Har den redan betalats återbetalas beloppet.

Vänliga hälsningar
Sockerbagaren`,
    attachments,
    type: "CREDIT_NOTE",
    orderId: invoice.orderId,
  });

  return credit;
}
