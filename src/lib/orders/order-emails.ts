import { invoiceConfig, orderPolicy } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailConfig, siteConfig } from "@/lib/config";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import { addDays, capitalizeFirst, changeDeadline, formatDeadline, formatDeliveryDate, formatDeliveryDateWithYear, formatLongDate, todayInStockholm } from "@/lib/dates";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { looksLikePersonalNumber } from "@/lib/validation";
import { isVerifiedValue } from "@/lib/config";
import { FREQUENCY_LABELS } from "@/lib/status";

// Transaktionell e-post vid order: orderbekräftelse till kontakt-e-post och
// faktura (med PDF-bilaga + nedladdningslänk) till faktura-e-post.
// Anropas EFTER att ordern är sparad. Fel loggas men kastas aldrig vidare.

export interface OrderEmailOptions {
  /** Extra rader till kunden (flyttad leveransdag, sort som utgått …). */
  customerNotes?: string[];
}

/** Skickar orderbekräftelse + faktura. Returnerar true bara när båda gick iväg. */
export async function sendOrderEmails(orderId: string, options: OrderEmailOptions = {}): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, invoice: true, deliveryArea: true, subscription: { select: { number: true, frequency: true } } },
  });
  if (!order || !order.invoice) return false;

  const lines = order.items
    .map(
      (i) =>
        `  ${i.productName}: ${qtyLabel(i.weightKg, i.unit)} à ${formatOre(i.unitPricePerKgOre)}${priceSuffix(i.unit)} exkl. moms`
    )
    .join("\n");
  const deliveryDay = capitalizeFirst(formatDeliveryDateWithYear(order.deliveryDate));
  const invoiceUrl = `${siteConfig.url}/faktura/${order.invoice.downloadToken}`;
  const sub = order.subscription;
  const frequencyLabel = sub ? (FREQUENCY_LABELS[sub.frequency as keyof typeof FREQUENCY_LABELS] ?? sub.frequency).toLowerCase() : "";

  // Ändringsfristen: för prenumerationsordrar skapas ordern bara några dagar
  // före leverans, och runt helgdagar kan fristen redan ha passerat när mejlet
  // går iväg. Då ska mejlet säga det – inte ange ett datum som redan är förbi.
  const deadline = changeDeadline(order.deliveryDate, orderPolicy.changeCutoffWorkdays, orderPolicy.changeCutoffHour);
  const deadlinePassed = deadline.getTime() <= Date.now();
  const changeLine = sub
    ? deadlinePassed
      ? "Den här leveransen är redan planerad i körningen och går inte att ändra. Vill ni ändra, pausa eller avsluta prenumerationen? Svara på det här mejlet – ändringen gäller från nästa leverans."
      : `Ändringar eller avbokning av den här leveransen: svara på det här mejlet senast ${formatDeadline(deadline)}. Vill ni ändra mängd, pausa eller avsluta prenumerationen? Svara på samma mejl – ändringen gäller från nästa leverans.`
    : deadlinePassed
      ? "Leveransen är planerad i körningen och kan inte längre ändras eller avbokas kostnadsfritt. Stämmer något inte? Svara på det här mejlet så löser vi det."
      : `Ändringar eller avbokning: svara på det här mejlet senast ${formatDeadline(deadline)}. Därefter är ordern packad och faktureras.`;
  const notes = (options.customerNotes ?? []).filter((n) => n.trim().length > 0);
  const notesBlock = notes.length > 0 ? `\nOBS\n${notes.map((n) => `  ${n}`).join("\n")}\n` : "";

  const confirmationText = `${sub ? `Nästa leverans i er fikaprenumeration är på gång.` : "Tack för er beställning!"}

Ordernummer: ${order.orderNumber}${sub ? `\nFikaprenumeration: ${sub.number} (${frequencyLabel})` : ""}
${notesBlock}
KAKOR
${lines}

Summa exkl. moms: ${formatOre(order.subtotalOre)}
Moms: ${formatOre(order.vatOre)}
Totalt inkl. moms: ${formatOre(order.totalOre)}

LEVERANS
${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}
Leveransdag: ${deliveryDay}${order.deliveryInstruction ? `\nLeveransanvisning: ${order.deliveryInstruction}` : ""}
Vi levererar under dagen – se till att någon finns på plats för att ta emot leveransen.
${changeLine}

FAKTURA
Betalning sker mot faktura. Fakturan skapas nu och skickas till ${order.invoiceEmail}. Förfallodatum ${formatLongDate(order.invoice.dueDate)} (${invoiceConfig.paymentTermsDays} dagar efter leveransen).
Ni kan även ladda ner den här: ${invoiceUrl}

Frågor? Svara på det här mejlet.

Vänliga hälsningar
Sockerbagaren`;

  const confirmationPromise = sendEmail({
    to: order.email,
    subject: sub
      ? `Fikaleverans ${formatDeliveryDateWithYear(order.deliveryDate)} (${sub.number}) – Sockerbagaren`
      : `Orderbekräftelse ${order.orderNumber} – Sockerbagaren`,
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

  // Betalningsuppgifter i själva mejlet när de är verifierade – mottagaren ska
  // kunna betala även om bilagan saknas. Platshållare skrivs aldrig ut.
  const paymentLines = [
    isVerifiedValue(invoiceConfig.bankgiro) ? `Bankgiro: ${invoiceConfig.bankgiro}` : "",
    `Referens vid betalning: ${order.invoice.invoiceNumber}`,
    `Säljare: ${invoiceConfig.companyName}, org.nr ${invoiceConfig.orgNumber}`,
  ].filter(Boolean);
  const invoiceText = `Faktura ${order.invoice.invoiceNumber} från Sockerbagaren (order ${order.orderNumber}${sub ? `, fikaprenumeration ${sub.number}` : ""})

Belopp att betala: ${formatOre(order.totalOre)} inkl. moms
Förfallodatum: ${formatLongDate(order.invoice.dueDate)} (${invoiceConfig.paymentTermsDays} dagar efter leveransen ${formatLongDate(order.deliveryDate)})
${paymentLines.join("\n")}

${attachments ? "Fakturan bifogas som PDF." : ""}
Ladda ner fakturan: ${invoiceUrl}
Länken fungerar tills vidare – spara mejlet. Behöver ni en ny kopia senare: svara på det här mejlet med fakturanumret.

Vänliga hälsningar
Sockerbagaren`;

  const invoicePromise = sendEmail({
    to: order.invoiceEmail,
    subject: `Faktura ${order.invoice.invoiceNumber} – Sockerbagaren`,
    text: invoiceText,
    attachments,
    type: "INVOICE",
    orderId: order.id,
  });
  // Verksamheten ska inte behöva logga in för att upptäcka en ny order.
  // Alla tre utskick går parallellt: tre seriella 10 s-timeouts + PDF skulle
  // annars kunna passera funktionens tidsgräns efter att ordern redan sparats.
  const adminPromise = !emailConfig.adminNotify
    ? Promise.resolve(false)
    : sendEmail({
      to: emailConfig.adminNotify,
      subject: `${sub ? `Prenumerationsorder ${order.orderNumber} (${sub.number})` : `Ny order ${order.orderNumber}`} – ${order.companyName} (${formatOre(order.totalOre)})`,
      text: `Ny beställning via webben.

Order: ${order.orderNumber}
Kund: ${order.companyName} (${order.orgNumber})${looksLikePersonalNumber(order.orgNumber) ? " – OBS: personnummerformat, troligen enskild firma" : ""}
Kontakt: ${order.contactName}, ${order.email}${order.phone ? `, ${order.phone}` : ""}
Leverans: ${deliveryDay} – ${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}${order.deliveryArea ? ` (${order.deliveryArea.name})` : ""}
${order.deliveryInstruction ? `Leveransanvisning: ${order.deliveryInstruction}\n` : ""}
KAKOR
${lines}

Totalt inkl. moms: ${formatOre(order.totalOre)}
Admin: ${siteConfig.url}/admin/bestallningar/${order.id}`,
      type: "ADMIN_NEW_ORDER",
      orderId: order.id,
    });
  const [confirmationSent, invoiceSent] = await Promise.all([confirmationPromise, invoicePromise, adminPromise]);
  return confirmationSent && invoiceSent;
}

/**
 * Leveransbekräftelse till kontakt-e-post när ordern markerats levererad.
 * Kunden ska inte behöva undra om kakorna kom fram – och påminnelsen om
 * fakturan minskar sena betalningar. Returnerar false om mejlet inte gick.
 */
export async function sendDeliveryConfirmationEmail(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, invoice: { include: { creditNotes: true } } },
  });
  if (!order || order.deliveryStatus !== "DELIVERED") return false;
  const lines = order.items.map((i) => `  ${i.productName}: ${qtyLabel(i.weightKg, i.unit)}`).join("\n");
  // Belopp efter eventuell delkreditering – aldrig originalbeloppet när en del krediterats.
  const credited = order.invoice?.creditNotes.reduce((s, c) => s + c.totalOre, 0) ?? 0; // negativt
  const toPay = order.invoice ? Math.max(0, order.invoice.totalOre + credited) : 0;
  const invoicePart =
    order.invoice && order.paymentStatus !== "PAID" && order.invoice.status !== "CREDITED" && toPay > 0
      ? `\nFAKTURA\nFaktura ${order.invoice.invoiceNumber} på ${formatOre(toPay)} inkl. moms${credited !== 0 ? ` (efter kreditering ${formatOre(-credited)})` : ""} förfaller ${formatLongDate(order.invoice.dueDate)} (${invoiceConfig.paymentTermsDays} dagar efter leveransen).\nLadda ner fakturan: ${siteConfig.url}/faktura/${order.invoice.downloadToken}\n`
      : "";
  const text = `Nu är kakorna levererade!

Order ${order.orderNumber} har lämnats på ${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity} i dag, ${formatDeliveryDateWithYear(order.deliveredAt ?? order.deliveryDate)}.

KAKOR
${lines}

Förvara kakorna i tät burk eller stängd förpackning i rumstemperatur – helt tätt behåller de mjukheten, lite luft gör dem sprödare. Bäst före-datum står på förpackningen.
${invoicePart}
Saknas något eller stämmer inte leveransen? Svara på det här mejlet så rättar vi till det.

Vänliga hälsningar
Sockerbagaren`;
  return sendEmail({
    to: order.email,
    subject: `Levererat: ${order.orderNumber} – Sockerbagaren`,
    text,
    type: "DELIVERY_CONFIRMATION",
    orderId: order.id,
  });
}

/**
 * Vänlig betalningspåminnelse till faktura-e-post. Skickas manuellt från admin
 * (aldrig automatiskt – en påminnelse till en kund som just betalat skadar
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
  const due = formatLongDate(invoice.dueDate);
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
${credited !== 0 ? `Beloppet är efter kreditering med kreditfaktura ${invoice.creditNotes.map((c) => c.creditNumber).join(", ")} (${formatOre(-credited)}). Den bifogade fakturan visar ursprungsbeloppet.\n` : ""}
${attachments ? "Fakturan bifogas på nytt som PDF." : ""}
Ladda ner fakturan: ${siteConfig.url}/faktura/${invoice.downloadToken}

Har betalningen redan gjorts kan ni bortse från det här mejlet – svara gärna med betaldatum så stämmer vi av.

Vänliga hälsningar
Sockerbagaren`;
  return sendEmail({
    to: order.invoiceEmail,
    subject: `${overdue ? "Påminnelse" : "Vänlig påminnelse"}: faktura ${invoice.invoiceNumber} – Sockerbagaren`,
    text,
    attachments,
    type: "PAYMENT_REMINDER",
    orderId: order.id,
  });
}

/**
 * Leveranspåminnelse dagen före till kontakt-e-posten: "i morgon kommer fikat,
 * se till att någon kan ta emot". Idempotent via e-postloggen – cronen kan
 * köras flera gånger samma dag utan dubbla mejl. Returnerar antal skickade.
 */
export async function sendDeliveryReminders(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const tomorrow = addDays(todayInStockholm(now), 1);
  const orders = await prisma.order.findMany({
    where: { deliveryDate: tomorrow, status: { not: "CANCELLED" }, deliveryStatus: { not: "DELIVERED" } },
    include: { items: true, subscription: { select: { number: true } } },
    orderBy: { orderNumber: "asc" },
  });
  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const order of orders) {
    const already = await prisma.emailLog.findFirst({
      where: { orderId: order.id, type: "DELIVERY_REMINDER", status: "SENT" },
      select: { id: true },
    });
    if (already) {
      result.skipped++;
      continue;
    }
    const lines = order.items.map((i) => `  ${i.productName}: ${qtyLabel(i.weightKg, i.unit)}`).join("\n");
    const day = formatDeliveryDate(order.deliveryDate);
    const ok = await sendEmail({
      to: order.email,
      subject: `I morgon kommer fikat – ${day} (${order.orderNumber}) – Sockerbagaren`,
      text: `Hej!

I morgon, ${day}, levererar vi ${order.subscription ? `nästa leverans i er fikaprenumeration ${order.subscription.number}` : `er beställning ${order.orderNumber}`}.

LEVERANS
${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}${order.deliveryInstruction ? `\nLeveransanvisning: ${order.deliveryInstruction}` : ""}
Vi levererar under dagen – se till att någon finns på plats för att ta emot leveransen.

KAKOR
${lines}

Stämmer något inte, eller är ingen på plats i morgon? Svara på det här mejlet så snart som möjligt.

Vänliga hälsningar
Sockerbagaren`,
      type: "DELIVERY_REMINDER",
      orderId: order.id,
    });
    if (ok) result.sent++;
    else result.failed++;
  }
  return result;
}
