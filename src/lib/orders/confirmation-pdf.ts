import PDFDocument from "pdfkit";
import { SIGILL_PNG_BASE64 } from "@/lib/invoice/sigill-png";
import { invoiceConfig, orderPolicy } from "@/lib/config";
import { formatOre } from "@/lib/money";
import { priceSuffix, qtyLabel } from "@/lib/units";
import {
  capitalizeFirst,
  changeDeadline,
  formatDeadline,
  formatDeliveryDateWithYear,
  formatLongDate,
} from "@/lib/dates";
import { FREQUENCY_LABELS } from "@/lib/status";

const BROWN = "#3B281B";
const MUTED = "#7A614D";
const BORDER = "#D9C9A6";
const LIGHT = "#F7EFDD";
const M = 50;
const W = 595.28;
const CONTENT_W = W - M * 2;

function pdfText(s: string): string {
  return s.replace(/[\u202f\u00a0]/g, " ").replace(/\u2212/g, "-");
}

function pdfMoney(ore: number): string {
  return pdfText(formatOre(ore));
}

export type ConfirmationOrder = {
  orderNumber: string;
  email: string;
  invoiceEmail: string;
  companyName: string;
  orgNumber: string;
  contactName: string;
  phone: string;
  reference: string;
  deliveryAddress: string;
  deliveryPostalCode: string;
  deliveryCity: string;
  deliveryInstruction: string;
  deliveryDate: Date;
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
  items: { productName: string; weightKg: number; unit: string; unitPricePerKgOre: number; lineTotalOre: number }[];
  invoice: { invoiceNumber: string; dueDate: Date } | null;
  subscription: { number: string; frequency: string } | null;
  customerNotes?: string[];
};

export function renderOrderConfirmationPdf(order: ConfirmationOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: M, left: M, right: M, bottom: 48 },
      bufferPages: true,
      info: { Title: `Orderbekräftelse ${order.orderNumber}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.image(Buffer.from(SIGILL_PNG_BASE64, "base64"), M, M - 4, { width: 44 });
    } catch {
      // sigill saknas
    }

    doc.font("Helvetica-Bold").fontSize(16).fillColor(BROWN);
    doc.text("SOCKERBAGAREN", M + 56, M + 4);
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    doc.text(invoiceConfig.companyName, M + 56, M + 23);

    doc.font("Helvetica-Bold").fontSize(18).fillColor(BROWN);
    doc.text("ORDERBEKRÄFTELSE", M, M, { width: CONTENT_W, align: "right" });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED);
    doc.text(order.orderNumber, M, M + 24, { width: CONTENT_W, align: "right" });

    let y = M + 56;
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1.5).strokeColor(BROWN).stroke();
    y += 18;

    const colW = CONTENT_W / 2 - 16;
    const col2 = M + CONTENT_W / 2 + 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("KUND", M, y);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BROWN).text(pdfText(order.companyName), M, y + 12, { width: colW, height: 28, ellipsis: true });
    doc.font("Helvetica").fontSize(9.5).fillColor(BROWN);
    doc.text(`Org.nr ${order.orgNumber}`, M, y + 28, { width: colW, height: 14, ellipsis: true });
    doc.text(pdfText(order.contactName), M, y + 42, { width: colW, height: 14, ellipsis: true });
    if (order.phone) doc.text(order.phone, M, y + 56, { width: colW, height: 14, ellipsis: true });
    if (order.reference) doc.text(`Er referens: ${pdfText(order.reference)}`, M, y + 70, { width: colW, height: 14, ellipsis: true });

    const deliveryDay = capitalizeFirst(formatDeliveryDateWithYear(order.deliveryDate));
    const sub = order.subscription;
    const frequencyLabel = sub ? (FREQUENCY_LABELS[sub.frequency as keyof typeof FREQUENCY_LABELS] ?? sub.frequency).toLowerCase() : "";
    const meta: [string, string][] = [
      ["Leveransdag", pdfText(deliveryDay)],
      ["Adress", pdfText(`${order.deliveryAddress}, ${order.deliveryPostalCode} ${order.deliveryCity}`)],
      ...(order.deliveryInstruction ? ([["Anvisning", pdfText(order.deliveryInstruction)]] as [string, string][]) : []),
      ...(sub ? ([["Prenumeration", `${sub.number} (${frequencyLabel})`]] as [string, string][]) : []),
      ...(order.invoice ? ([["Faktura", order.invoice.invoiceNumber]] as [string, string][]) : []),
    ];
    let ry = y;
    for (const [label, value] of meta) {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, col2, ry, { width: 78, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BROWN).text(value, col2 + 80, ry, { width: colW - 70, height: 24, ellipsis: true });
      ry += value.length > 42 ? 26 : 16;
    }

    y = Math.max(y + 96, ry + 12);

    doc.rect(M, y, CONTENT_W, 22).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BROWN);
    doc.text("PRODUKT", M + 8, y + 7);
    doc.text("ANTAL", M + 250, y + 7, { width: 70, align: "right" });
    doc.text("À-PRIS", M + 330, y + 7, { width: 80, align: "right" });
    doc.text("BELOPP", M + 420, y + 7, { width: CONTENT_W - 428, align: "right" });
    y += 22;

    doc.font("Helvetica").fontSize(10).fillColor(BROWN);
    for (const line of order.items) {
      const rowY = y + 8;
      doc.font("Helvetica-Bold").text(pdfText(line.productName), M + 8, rowY, { width: 230, height: 14, ellipsis: true, lineBreak: false });
      doc.font("Helvetica");
      doc.text(pdfText(qtyLabel(line.weightKg, line.unit)), M + 250, rowY, { width: 70, align: "right", lineBreak: false });
      doc.text(`${pdfMoney(line.unitPricePerKgOre)}${priceSuffix(line.unit)}`, M + 330, rowY, { width: 80, align: "right", lineBreak: false });
      doc.text(pdfMoney(line.lineTotalOre), M + 420, rowY, { width: CONTENT_W - 428, align: "right", lineBreak: false });
      y += 26;
      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    }
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text("À-pris och radbelopp anges exkl. moms.", M + 8, y + 5, { lineBreak: false });
    y += 20;

    const sumX = M + 300;
    const sums: [string, string, boolean][] = [
      ["Netto", pdfMoney(order.subtotalOre), false],
      ["Moms", pdfMoney(order.vatOre), false],
      ["Totalt inkl. moms", pdfMoney(order.totalOre), true],
    ];
    for (const [label, value, bold] of sums) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(BROWN);
      doc.text(label, sumX, y, { width: 110 });
      doc.text(value, sumX + 110, y, { width: W - M - sumX - 110, align: "right" });
      y += bold ? 20 : 16;
    }

    y += 14;
    const deadline = changeDeadline(order.deliveryDate, orderPolicy.changeCutoffWorkdays, orderPolicy.changeCutoffHour);
    const deadlinePassed = deadline.getTime() <= Date.now();
    const changeText = order.subscription
      ? deadlinePassed
        ? "Den här leveransen är redan planerad i körningen och ändras i självbetjäningen från nästa leverans."
        : `Ändringar av den här leveransen: svara på mejlet senast ${pdfText(formatDeadline(deadline))}.`
      : deadlinePassed
        ? "Leveransen är planerad i körningen och kan inte längre ändras kostnadsfritt."
        : `Ändringar eller avbokning: svara på orderbekräftelsen senast ${pdfText(formatDeadline(deadline))}.`;

    const boxH = 92;
    doc.rect(M, y, CONTENT_W, boxH).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("DETTA ÄR INTE EN FAKTURA", M + 12, y + 10);
    doc.font("Helvetica").fontSize(9.5).fillColor(BROWN);
    const invoiceLine = order.invoice
      ? `Faktura ${order.invoice.invoiceNumber} skickas separat till ${order.invoiceEmail}. Förfaller ${pdfText(formatLongDate(order.invoice.dueDate))} (${invoiceConfig.paymentTermsDays} dagar efter leveransen).`
      : "Fakturan skickas separat.";
    doc.text(invoiceLine, M + 12, y + 26, { width: CONTENT_W - 24 });
    doc.text(`Vi levererar under dagen ${pdfText(deliveryDay)}. Se till att någon finns på plats.`, M + 12, y + 50, { width: CONTENT_W - 24 });
    doc.text(changeText, M + 12, y + 66, { width: CONTENT_W - 24 });

    const notes = (order.customerNotes ?? []).filter((n) => n.trim());
    if (notes.length > 0) {
      y += boxH + 16;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("MEDDELANDE", M, y);
      doc.font("Helvetica").fontSize(9.5).fillColor(BROWN);
      doc.text(notes.map((n) => pdfText(n)).join("\n"), M, y + 14, { width: CONTENT_W });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(
        `${invoiceConfig.companyName} · org.nr ${invoiceConfig.orgNumber} · sockerbagaren.se · sida ${i + 1} av ${range.count}`,
        M,
        780,
        { width: CONTENT_W, align: "center" }
      );
    }
    doc.end();
  });
}
