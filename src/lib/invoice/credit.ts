import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { parseSnapshot, type InvoiceSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { sendEmail } from "@/lib/email";
import { formatOre } from "@/lib/money";
import { siteConfig } from "@/lib/config";
import { todayInStockholm, toISODate } from "@/lib/dates";

// Kreditfaktura när en fakturerad order avbryts. Nummer ur samma obrutna
// fakturaserie, eget snapshot (originalets rader + referens till fakturan),
// egen nedladdningslänk. Originalfakturan markeras CREDITED — aldrig raderad.
// Databasdelen kan köras inne i anroparens transaktion (avbrytande + kreditering
// atomiskt); mejlet skickas efter commit och påverkar aldrig krediteringen.

type Tx = Prisma.TransactionClient;

export async function issueCreditNoteInTx(tx: Tx, invoiceId: string, actor: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { creditNote: true },
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
}

/** Mejlar kreditfakturan (PDF + länk) till fakturamottagaren. Kastar aldrig. */
export async function sendCreditNoteEmail(creditNoteId: string): Promise<boolean> {
  const credit = await prisma.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { invoice: { include: { order: true } } },
  });
  if (!credit) return false;
  const invoice = credit.invoice;
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const pdf = await renderInvoicePdf(parseSnapshot(credit.snapshotJson), credit.creditNumber);
    attachments = [{ filename: `kreditfaktura-${credit.creditNumber}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch (e) {
    console.error("Kreditfaktura-PDF misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
  }
  return sendEmail({
    to: invoice.order.invoiceEmail,
    subject: `Kreditfaktura ${credit.creditNumber} — Sockerbagaren`,
    text: `Order ${invoice.order.orderNumber} har avbrutits och faktura ${invoice.invoiceNumber} krediteras i sin helhet.

Kreditfaktura: ${credit.creditNumber}
Krediterat belopp: ${formatOre(invoice.totalOre)} inkl. moms
Ladda ner kreditfakturan: ${siteConfig.url}/faktura/${credit.downloadToken}

Fakturan ska inte betalas. Har den redan betalats återbetalas beloppet.

Vänliga hälsningar
Sockerbagaren`,
    attachments,
    type: "CREDIT_NOTE",
    orderId: invoice.orderId,
  });
}

/** Fristående variant (egen transaktion + mejl). Idempotent. */
export async function issueCreditNote(invoiceId: string, actor: string) {
  const credit = await prisma.$transaction((tx) => issueCreditNoteInTx(tx, invoiceId, actor), { timeout: 15000 });
  if (credit) await sendCreditNoteEmail(credit.id);
  return credit;
}
