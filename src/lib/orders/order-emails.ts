import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/config";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import { formatDeliveryDate } from "@/lib/dates";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";

// Transaktionell e-post vid order: orderbekräftelse till kontakt-e-post och
// faktura (med PDF-bilaga + nedladdningslänk) till faktura-e-post.
// Anropas EFTER att ordern är sparad. Fel loggas men kastas aldrig vidare.

/** Skickar orderbekräftelse + faktura. Returnerar true bara när båda gick iväg. */
export async function sendOrderEmails(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, invoice: true, deliveryArea: true },
  });
  if (!order || !order.invoice) return false;

  const lines = order.items
    .map(
      (i) =>
        `  ${i.productName}: ${qtyLabel(i.weightKg, i.unit)} à ${formatOre(i.unitPricePerKgOre)}${priceSuffix(i.unit)}`
    )
    .join("\n");
  const deliveryDay = formatDeliveryDate(order.deliveryDate);
  const invoiceUrl = `${siteConfig.url}/faktura/${order.invoice.downloadToken}`;

  const confirmationText = `Tack för er beställning!

Ordernummer: ${order.orderNumber}

KAKOR
${lines}

Summa: ${formatOre(order.subtotalOre)}
Moms: ${formatOre(order.vatOre)}
Totalt: ${formatOre(order.totalOre)}

LEVERANS
${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}
Leveransdag: ${deliveryDay}
Vi levererar under dagen — se till att någon finns på plats för att ta emot leveransen.

FAKTURA
Betalning sker mot faktura. Fakturan skickas till ${order.invoiceEmail}.
Ni kan även ladda ner den här: ${invoiceUrl}

Frågor? Svara på det här mejlet.

Vänliga hälsningar
Sockerbagaren`;

  const confirmationSent = await sendEmail({
    to: order.email,
    subject: `Orderbekräftelse ${order.orderNumber} — Sockerbagaren`,
    text: confirmationText,
    type: "ORDER_CONFIRMATION",
    orderId: order.id,
  });

  // Faktura med PDF-bilaga. Om PDF-renderingen fallerar skickas mejlet
  // ändå med nedladdningslänk.
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const snapshot = parseSnapshot(order.invoice.snapshotJson);
    const pdf = await renderInvoicePdf(snapshot, order.invoice.invoiceNumber);
    attachments = [
      {
        filename: `faktura-${order.invoice.invoiceNumber}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ];
  } catch (e) {
    console.error("PDF-bilaga kunde inte genereras:", e);
  }

  const invoiceText = `Faktura ${order.invoice.invoiceNumber} från Sockerbagaren (${order.orderNumber})

Belopp att betala: ${formatOre(order.totalOre)}
Förfallodatum: ${order.invoice.dueDate.toISOString().slice(0, 10)}

${attachments ? "Fakturan bifogas som PDF." : ""}
Ladda ner fakturan: ${invoiceUrl}

Vänliga hälsningar
Sockerbagaren`;

  const invoiceSent = await sendEmail({
    to: order.invoiceEmail,
    subject: `Faktura ${order.invoice.invoiceNumber} — Sockerbagaren`,
    text: invoiceText,
    attachments,
    type: "INVOICE",
    orderId: order.id,
  });
  return confirmationSent && invoiceSent;
}
