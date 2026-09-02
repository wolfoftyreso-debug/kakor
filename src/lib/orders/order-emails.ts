import { invoiceConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailConfig, siteConfig } from "@/lib/config";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import { formatDeliveryDateWithYear } from "@/lib/dates";
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
        `  ${i.productName}: ${qtyLabel(i.weightKg, i.unit)} à ${formatOre(i.unitPricePerKgOre)}${priceSuffix(i.unit)} exkl. moms`
    )
    .join("\n");
  const deliveryDay = formatDeliveryDateWithYear(order.deliveryDate);
  const invoiceUrl = `${siteConfig.url}/faktura/${order.invoice.downloadToken}`;

  const confirmationText = `Tack för er beställning!

Ordernummer: ${order.orderNumber}

KAKOR
${lines}

Summa exkl. moms: ${formatOre(order.subtotalOre)}
Moms: ${formatOre(order.vatOre)}
Totalt inkl. moms: ${formatOre(order.totalOre)}

LEVERANS
${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}
Leveransdag: ${deliveryDay}
Vi levererar under dagen — se till att någon finns på plats för att ta emot leveransen.

FAKTURA
Betalning sker mot faktura. Fakturan skapas nu och skickas till ${order.invoiceEmail}. Förfallodatum ${order.invoice.dueDate.toISOString().slice(0, 10)} (${invoiceConfig.paymentTermsDays} dagar efter leveransen).
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

Belopp att betala: ${formatOre(order.totalOre)} inkl. moms
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
  // Verksamheten ska inte behöva logga in för att upptäcka en ny order.
  if (emailConfig.adminNotify) {
    await sendEmail({
      to: emailConfig.adminNotify,
      subject: `Ny order ${order.orderNumber} — ${order.companyName} (${formatOre(order.totalOre)})`,
      text: `Ny beställning via webben.

Order: ${order.orderNumber}
Kund: ${order.companyName} (${order.orgNumber})
Kontakt: ${order.contactName}, ${order.email}${order.phone ? `, ${order.phone}` : ""}
Leverans: ${deliveryDay} — ${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}${order.deliveryArea ? ` (${order.deliveryArea.name})` : ""}
${order.deliveryInstruction ? `Kommentar: ${order.deliveryInstruction}\n` : ""}
KAKOR
${lines}

Totalt inkl. moms: ${formatOre(order.totalOre)}
Admin: ${siteConfig.url}/admin/bestallningar/${order.id}`,
      type: "ADMIN_NEW_ORDER",
      orderId: order.id,
    });
  }
  return confirmationSent && invoiceSent;
}
