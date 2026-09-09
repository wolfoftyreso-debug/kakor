import PDFDocument from "pdfkit";
import { SIGILL_PNG_BASE64 } from "@/lib/invoice/sigill-png";
import { capitalizeFirst, formatDeliveryDateWithYear, fromISODate } from "@/lib/dates";
import { formatWeightKg, qtyLabel } from "@/lib/units";
import type { DeliverySnapshot, SnapshotStop } from "./types";

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

function qty(q: number, unit: string): string {
  return pdfText(qtyLabel(q, unit));
}

function kg(grams: number): string {
  return pdfText(formatWeightKg(grams));
}

function startDoc(title: string): { doc: PDFKit.PDFDocument; chunks: Buffer[]; done: Promise<Buffer> } {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: M, left: M, right: M, bottom: 48 },
    bufferPages: true,
    info: { Title: title },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, chunks, done };
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  try {
    doc.image(Buffer.from(SIGILL_PNG_BASE64, "base64"), M, M - 4, { width: 40 });
  } catch {
    // sigill saknas – fortsätt utan bild
  }
  doc.font("Helvetica-Bold").fontSize(14).fillColor(BROWN);
  doc.text("SOCKERBAGAREN", M + 50, M + 2);
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text("sockerbagaren.se", M + 50, M + 20);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(BROWN);
  doc.text(title, M, M, { width: CONTENT_W, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED);
  doc.text(subtitle, M, M + 22, { width: CONTENT_W, align: "right" });
  doc.moveTo(M, M + 48).lineTo(W - M, M + 48).lineWidth(1.5).strokeColor(BROWN).stroke();
}

function footer(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(`Sockerbagaren · intern leveranshandling · sida ${i + 1} av ${range.count}`, M, 780, {
      width: CONTENT_W,
      align: "center",
    });
  }
}

function needMore(doc: PDFKit.PDFDocument, y: number, need: number): number {
  if (y + need < 760) return y;
  doc.addPage();
  return M;
}

export function renderDeliveryListPdf(snapshot: DeliverySnapshot): Promise<Buffer> {
  const dateLabel = capitalizeFirst(formatDeliveryDateWithYear(fromISODate(snapshot.deliveryDate)));
  const { doc, done } = startDoc(`Leveranslista ${snapshot.deliveryDate}`);
  header(doc, "LEVERANSLISTA", dateLabel);
  let y = M + 64;
  doc.font("Helvetica").fontSize(10).fillColor(BROWN);
  doc.text(
    `${snapshot.orderCount} leverans${snapshot.orderCount === 1 ? "" : "er"} · ${kg(snapshot.totalGrams)} totalt`,
    M,
    y
  );
  y += 22;

  snapshot.stops.forEach((stop, idx) => {
    y = needMore(doc, y, 110);
    doc.rect(M, y, CONTENT_W, 18).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BROWN);
    doc.text(`STOPP ${idx + 1}  ${stop.companyName}`, M + 8, y + 4, { width: CONTENT_W - 16 });
    y += 24;
    doc.font("Helvetica").fontSize(10).fillColor(BROWN);
    doc.text(`${stop.deliveryAddress}, ${stop.deliveryPostalCode} ${stop.deliveryCity}`, M, y);
    y += 14;
    doc.fillColor(MUTED).text(`Kontakt: ${stop.contactName}${stop.phone ? `  ${stop.phone}` : ""}`, M, y);
    y += 14;
    if (stop.subscriptionNumber) {
      doc.text(`Prenumeration ${stop.subscriptionNumber} · ${stop.orderNumber}`, M, y);
      y += 14;
    } else {
      doc.text(`Engångsorder ${stop.orderNumber}`, M, y);
      y += 14;
    }
    doc.fillColor(BROWN).font("Helvetica-Bold").text("Leverans:", M, y);
    y += 14;
    doc.font("Helvetica");
    for (const item of stop.items) {
      doc.text(`  ${qty(item.qty, item.unit)}  ${item.productName}`, M, y);
      y += 13;
    }
    if (stop.deliveryInstruction) {
      y += 2;
      doc.font("Helvetica-Oblique").fillColor(MUTED).text(`Kommentar: ${pdfText(stop.deliveryInstruction)}`, M, y, {
        width: CONTENT_W,
      });
      y += doc.heightOfString(`Kommentar: ${stop.deliveryInstruction}`, { width: CONTENT_W }) + 4;
    }
    y += 10;
  });

  y = needMore(doc, y, 40 + snapshot.byProduct.length * 16);
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).strokeColor(BROWN).stroke();
  y += 12;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BROWN).text("TOTALT ATT LASTA", M, y);
  y += 18;
  doc.font("Helvetica").fontSize(11);
  for (const p of snapshot.byProduct) {
    doc.text(`${p.name}: ${qty(p.qty, p.unit)}`, M, y);
    y += 15;
  }
  y += 6;
  doc.font("Helvetica-Bold").text(`Totalt: ${kg(snapshot.totalGrams)}`, M, y);
  footer(doc);
  doc.end();
  return done;
}

export function renderPickListPdf(snapshot: DeliverySnapshot): Promise<Buffer> {
  const dateLabel = capitalizeFirst(formatDeliveryDateWithYear(fromISODate(snapshot.deliveryDate)));
  const { doc, done } = startDoc(`Plocklista ${snapshot.deliveryDate}`);
  header(doc, "PLOCKLISTA", dateLabel);
  let y = M + 64;

  const byProduct = new Map<string, { name: string; unit: string; qty: number; rows: { company: string; orderNumber: string; qty: number; unit: string }[] }>();
  for (const stop of snapshot.stops) {
    for (const item of stop.items) {
      const key = `${item.productId ?? item.productName}|${item.unit}`;
      const cur = byProduct.get(key) ?? { name: item.productName, unit: item.unit, qty: 0, rows: [] };
      cur.qty += item.qty;
      cur.rows.push({ company: stop.companyName, orderNumber: stop.orderNumber, qty: item.qty, unit: item.unit });
      byProduct.set(key, cur);
    }
  }

  for (const p of [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, "sv"))) {
    y = needMore(doc, y, 40 + p.rows.length * 16);
    doc.rect(M, y, CONTENT_W, 20).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BROWN);
    doc.text(`${p.name.toUpperCase()}   Totalt: ${qty(p.qty, p.unit)}`, M + 8, y + 5, { width: CONTENT_W - 16 });
    y += 26;
    doc.font("Helvetica").fontSize(10);
    for (const row of p.rows) {
      y = needMore(doc, y, 16);
      doc.fillColor(BROWN).text(`[ ]  ${row.company}  –  ${qty(row.qty, row.unit)}   (${row.orderNumber})`, M + 4, y);
      y += 15;
    }
    y += 10;
  }
  footer(doc);
  doc.end();
  return done;
}

function packingSlipPage(doc: PDFKit.PDFDocument, stop: SnapshotStop, deliveryDate: string, first: boolean) {
  if (!first) doc.addPage();
  header(
    doc,
    "LEVERANSSEDEL",
    `${stop.orderNumber} · ${capitalizeFirst(formatDeliveryDateWithYear(fromISODate(deliveryDate)))}`
  );
  let y = M + 64;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("KUND", M, y);
  y += 12;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BROWN).text(stop.companyName, M, y);
  y += 16;
  doc.font("Helvetica").fontSize(10);
  if (stop.orgNumber) {
    doc.text(`Org.nr ${stop.orgNumber}`, M, y);
    y += 14;
  }
  doc.text(`${stop.deliveryAddress}`, M, y);
  y += 14;
  doc.text(`${stop.deliveryPostalCode} ${stop.deliveryCity}`, M, y);
  y += 14;
  doc.fillColor(MUTED).text(`${stop.contactName}${stop.phone ? ` · ${stop.phone}` : ""}`, M, y);
  y += 20;
  if (stop.reference) {
    doc.fillColor(BROWN).text(`Kundreferens: ${stop.reference}`, M, y);
    y += 14;
  }
  if (stop.subscriptionNumber) {
    doc.text(`Prenumeration ${stop.subscriptionNumber}`, M, y);
    y += 14;
  }
  if (stop.deliveryInstruction) {
    doc.rect(M, y, CONTENT_W, 8 + doc.heightOfString(stop.deliveryInstruction, { width: CONTENT_W - 16 })).strokeColor(BORDER).stroke();
    doc.font("Helvetica-Bold").text("Leveransanvisning", M + 8, y + 4);
    doc.font("Helvetica").text(pdfText(stop.deliveryInstruction), M + 8, y + 18, { width: CONTENT_W - 16 });
    y += 28 + doc.heightOfString(stop.deliveryInstruction, { width: CONTENT_W - 16 });
  }
  y += 8;
  doc.moveTo(M, y).lineTo(W - M, y).strokeColor(BROWN).stroke();
  y += 10;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
  doc.text("SORT", M, y);
  doc.text("MÄNGD", M + 320, y, { width: 80, align: "right" });
  doc.text("PACKAT", M + 410, y, { width: 80, align: "right" });
  y += 14;
  doc.font("Helvetica").fontSize(11).fillColor(BROWN);
  for (const item of stop.items) {
    doc.text(item.productName, M, y, { width: 300 });
    doc.text(qty(item.qty, item.unit), M + 320, y, { width: 80, align: "right" });
    doc.text("[  ]", M + 410, y, { width: 80, align: "right" });
    y += 18;
  }
  y += 8;
  doc.font("Helvetica-Bold").text(`Totalt ${kg(stop.totalGrams)}`, M, y);
  y += 36;
  doc.moveTo(M, y).lineTo(M + 200, y).strokeColor(BROWN).stroke();
  doc.moveTo(M + 260, y).lineTo(M + CONTENT_W, y).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text("Packat av / datum", M, y + 6);
  doc.text("Mottaget av / datum", M + 260, y + 6);
}

export function renderPackingSlipsPdf(snapshot: DeliverySnapshot): Promise<Buffer> {
  const { doc, done } = startDoc(`Leveranssedlar ${snapshot.deliveryDate}`);
  if (snapshot.stops.length === 0) {
    header(doc, "LEVERANSSEDEL", snapshot.deliveryDate);
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text("Inga leveranser den här dagen.", M, M + 64);
  } else {
    snapshot.stops.forEach((stop, i) => packingSlipPage(doc, stop, snapshot.deliveryDate, i === 0));
  }
  footer(doc);
  doc.end();
  return done;
}

export async function renderAllOpsPdfs(snapshot: DeliverySnapshot): Promise<{
  lista: Buffer;
  plock: Buffer;
  sedlar: Buffer;
}> {
  const [lista, plock, sedlar] = await Promise.all([
    renderDeliveryListPdf(snapshot),
    renderPickListPdf(snapshot),
    renderPackingSlipsPdf(snapshot),
  ]);
  return { lista, plock, sedlar };
}
