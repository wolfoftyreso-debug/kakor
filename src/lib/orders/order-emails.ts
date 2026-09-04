import { invoiceConfig, orderPolicy } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailConfig, siteConfig } from "@/lib/config";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import { changeDeadline, formatDeadline, formatDeliveryDateWithYear, toISODate, todayInStockholm } from "@/lib/dates";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { looksLikePersonalNumber } from "@/lib/validation";

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
Ändringar eller avbokning: svara på det här mejlet senast ${formatDeadline(changeDeadline(order.deliveryDate, orderPolicy.changeCutoffWorkdays, orderPolicy.changeCutoffHour))}. Därefter är ordern packad och faktureras.

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
Kund: ${order.companyName} (${order.orgNumber})${looksLikePersonalNumber(order.orgNumber) ? " — OBS: personnummerformat, troligen enskild firma" : ""}
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

/**
 * Leveransbekräftelse till kontakt-e-post när ordern markerats levererad.
 * Kunden ska inte behöva undra om kakorna kom fram — och påminnelsen om
 * fakturan minskar sena betalningar. Returnerar false om mejlet inte gick.
 */
export async function sendDeliveryConfirmationEmail(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, invoice: true },
  });
  if (!order || order.deliveryStatus !== "DELIVERED") return false;
  const lines = order.items.map((i) => `  ${i.productName}: ${qtyLabel(i.weightKg, i.unit)}`).join("\n");
  const invoicePart =
    order.invoice && order.paymentStatus !== "PAID" && order.invoice.status !== "CREDITED"
      ? `\nFAKTURA\nFaktura ${order.invoice.invoiceNumber} på ${formatOre(order.totalOre)} inkl. moms förfaller ${toISODate(order.invoice.dueDate)} (${invoiceConfig.paymentTermsDays} dagar efter leveransen).\nLadda ner fakturan: ${siteConfig.url}/faktura/${order.invoice.downloadToken}\n`
      : "";
  const text = `Nu är kakorna levererade!

Order ${order.orderNumber} har lämnats på ${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity} i dag, ${formatDeliveryDateWithYear(order.deliveredAt ?? order.deliveryDate)}.

KAKOR
${lines}

Förvara kakorna torrt och svalt i stängd förpackning — då håller de sig krispiga i flera veckor.
${invoicePart}
Saknas något eller stämmer inte leveransen? Svara på det här mejlet så rättar vi till det.

Vänliga hälsningar
Sockerbagaren`;
  return sendEmail({
    to: order.email,
    subject: `Levererat: ${order.orderNumber} — Sockerbagaren`,
    text,
    type: "DELIVERY_CONFIRMATION",
    orderId: order.id,
  });
}

/**
 * Vänlig betalningspåminnelse till faktura-e-post. Skickas manuellt från admin
 * (aldrig automatiskt — en påminnelse till en kund som just betalat skadar
 * relationen mer än en dags försening). Fakturan bifogas igen som PDF.
 */
export async function sendPaymentReminderEmail(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoice: { include: { creditNotes: true } } },
  });
  if (!order || !order.invoice || order.paymentStatus === "PAID" || order.invoice.status === "CREDITED") return false;
  const invoice = order.invoice;
  const credited = invoice.creditNotes.reduce((s, c) => s + c.totalOre, 0); // negativt
  const toPay = Math.max(0, invoice.totalOre + credited);
  const due = toISODate(invoice.dueDate);
  const overdue = invoice.dueDate.getTime() < todayInStockholm().getTime();
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const pdf = await renderInvoicePdf(parseSnapshot(invoice.snapshotJson), invoice.invoiceNumber);
    attachments = [{ filename: `faktura-${invoice.invoiceNumber}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch (e) {
    console.error("Påminnelse-PDF misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
  }
  const text = `${overdue ? "Påminnelse: faktura" : "Vänlig påminnelse: faktura"} ${invoice.invoiceNumber} från Sockerbagaren

Vi har ännu inte sett någon betalning för faktura ${invoice.invoiceNumber} (order ${order.orderNumber}).

Belopp att betala: ${formatOre(toPay)} inkl. moms
Förfallodatum: ${due}${overdue ? " (passerat)" : ""}
${credited !== 0 ? `Beloppet är efter kreditering (${formatOre(-credited)}).\n` : ""}
${attachments ? "Fakturan bifogas på nytt som PDF." : ""}
Ladda ner fakturan: ${siteConfig.url}/faktura/${invoice.downloadToken}

Har betalningen redan gjorts kan ni bortse från det här mejlet — svara gärna med betaldatum så stämmer vi av.

Vänliga hälsningar
Sockerbagaren`;
  return sendEmail({
    to: order.invoiceEmail,
    subject: `${overdue ? "Påminnelse" : "Vänlig påminnelse"}: faktura ${invoice.invoiceNumber} — Sockerbagaren`,
    text,
    attachments,
    type: "PAYMENT_REMINDER",
    orderId: order.id,
  });
}
