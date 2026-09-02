import PDFDocument from "pdfkit";
import type { InvoiceSnapshot } from "@/lib/invoice/snapshot";
import { formatOre } from "@/lib/money";
import { qtyLabel } from "@/lib/units";
import { SIGILL_PNG_BASE64 } from "@/lib/invoice/sigill-png";
import { isVerifiedValue } from "@/lib/config";

// PDF-faktura — renderas enbart från fakturans snapshot (historiskt dokument).
// Diskret varumärkesfärg, standardtypsnitt (Helvetica) för stabil server-side-rendering.

const BROWN = "#3B281B";
const MUTED = "#7A614D";
const BORDER = "#D9C9A6";
const LIGHT_BG = "#F7EFDD";

const M = 50; // marginal
const W = 595.28; // A4 pt
const CONTENT_W = W - M * 2;

// pdfkit ritar med WinAnsi-Helvetica: Intl:s minustecken (U+2212) och smala
// mellanslag (U+202F) finns inte där och blir " — använd ASCII-minus och
// vanligt mellanslag i PDF:en.
function pdfMoney(ore: number): string {
  return formatOre(ore).replace(/\u2212/g, "-").replace(/[\u202f\u00a0]/g, " ");
}


// Kreditfaktura = samma dokument med negerade belopp och referens till originalet.
const isCredit = (snapshot: InvoiceSnapshot) => !!snapshot.creditsInvoiceNumber;
const signed = (snapshot: InvoiceSnapshot, ore: number) => (isCredit(snapshot) ? -ore : ore);

export function renderInvoicePdf(snapshot: InvoiceSnapshot, invoiceNumber: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const credit = isCredit(snapshot);
    const docTitle = credit ? "KREDITFAKTURA" : "FAKTURA";
    // Låg bottenmarginal så att den fasta sidfoten får plats utan sidbrytning.
    // bufferPages: sidfoten ritas på ALLA sidor när tabellen paginerar.
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: M, left: M, right: M, bottom: 20 },
      bufferPages: true,
      info: { Title: `${credit ? "Kreditfaktura" : "Faktura"} ${invoiceNumber}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- Sidhuvud: sigillet (primärsymbolen ur designsystemet) ---
    doc.image(Buffer.from(SIGILL_PNG_BASE64, "base64"), M, M - 4, { width: 44 });

    doc.font("Helvetica-Bold").fontSize(16).fillColor(BROWN);
    doc.text("SOCKERBAGAREN", M + 56, M + 4);
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    doc.text(snapshot.seller.companyName, M + 56, M + 23);

    doc.font("Helvetica-Bold").fontSize(22).fillColor(BROWN);
    doc.text(docTitle, M, M, { width: CONTENT_W, align: "right" });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED);
    doc.text(`${credit ? "Kreditfakturanummer" : "Fakturanummer"} ${invoiceNumber}`, M, M + 26, { width: CONTENT_W, align: "right" });

    let y = M + 56;
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1.5).stroke(BROWN);
    y += 18;

    // --- Parter + datum ---
    const col2 = M + CONTENT_W / 2 + 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("FAKTURAMOTTAGARE", M, y);
    // Bredd + höjdtak på alla kundfält: långa/flerradiga värden får aldrig
    // trycka ner resten av dokumentet (valideringen kollapsar radbrytningar,
    // men PDF:en ska tåla även äldre snapshots).
    const colW = CONTENT_W / 2 - 20;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BROWN).text(snapshot.buyer.companyName, M, y + 12, { width: colW, height: 28, ellipsis: true });
    doc.font("Helvetica").fontSize(9.5).fillColor(BROWN);
    doc.text(`Org.nr ${snapshot.buyer.orgNumber}`, M, y + 27, { width: colW, height: 14, ellipsis: true });
    doc.text(snapshot.buyer.billingAddress, M, y + 40, { width: colW, height: 52, ellipsis: true });
    if (snapshot.buyer.reference) {
      doc.text(`Er referens: ${snapshot.buyer.reference}`, M, doc.y + 2, { width: colW, height: 14, ellipsis: true });
    }

    const rows: [string, string][] = credit
      ? [
          ["Kreditdatum", (snapshot.invoiceDate)],
          ["Krediterar faktura", snapshot.creditsInvoiceNumber ?? ""],
          ["Ordernummer", snapshot.orderNumber],
          ["Avser leverans", (snapshot.deliveryDate)],
        ]
      : [
          ["Fakturadatum", (snapshot.invoiceDate)],
          ["Förfallodatum", (snapshot.dueDate)],
          ["Betalningsvillkor", `${snapshot.paymentTermsDays} dagar netto`],
          ["Ordernummer", snapshot.orderNumber],
          // Fakturan utfärdas vid beställning — leveransen ligger framåt i tiden.
          ["Planerad leverans", (snapshot.deliveryDate)],
        ];
    let ry = y;
    for (const [label, value] of rows) {
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(label, col2, ry, { width: 130 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BROWN).text(value, col2 + 130, ry);
      ry += 15;
    }

    y = Math.min(Math.max(doc.y + 14, ry + 14, y + 100), y + 130);

    // --- Radtabell (paginerar: tabellhuvudet ritas om på ny sida) ---
    const cols = { name: M, kg: M + 215, price: M + 285, vat: M + 370, total: M + 420 };
    const PAGE_BOTTOM = 700; // under detta bryts sidan (sidfot på 780)
    const drawTableHead = () => {
      doc.rect(M, y, CONTENT_W, 22).fill(LIGHT_BG);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BROWN);
      const headY = y + 7;
      doc.text("PRODUKT", cols.name + 8, headY);
      doc.text("ANTAL", cols.kg, headY, { width: 70, align: "right" });
      doc.text("À-PRIS", cols.price, headY, { width: 75, align: "right" });
      doc.text("MOMS", cols.vat, headY, { width: 40, align: "right" });
      doc.text("BELOPP", cols.total, headY, { width: W - M - cols.total - 8, align: "right" });
      y += 22;
    };
    drawTableHead();

    doc.font("Helvetica").fontSize(10).fillColor(BROWN);
    for (const line of snapshot.lines) {
      if (y + 26 > PAGE_BOTTOM) {
        doc.addPage();
        y = M;
        drawTableHead();
        doc.font("Helvetica").fontSize(10).fillColor(BROWN);
      }
      const rowY = y + 8;
      doc.font("Helvetica-Bold").text(line.productName, cols.name + 8, rowY, { width: 200, height: 14, ellipsis: true, lineBreak: false });
      doc.font("Helvetica");
      doc.text(qtyLabel(line.weightKg, line.unit ?? "kg"), cols.kg, rowY, { width: 70, align: "right", lineBreak: false });
      doc.text(pdfMoney(signed(snapshot, line.unitPricePerKgOre)), cols.price, rowY, { width: 75, align: "right", lineBreak: false });
      doc.text(`${String(line.vatRateBp / 100).replace(".", ",")} %`, cols.vat, rowY, { width: 40, align: "right", lineBreak: false });
      doc.text(pdfMoney(signed(snapshot, line.lineTotalOre)), cols.total, rowY, {
        width: W - M - cols.total - 8,
        align: "right",
        lineBreak: false,
      });
      y += 26;
      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).stroke(BORDER);
    }
    // Summering + betalningsblock behöver ~200 pt — bryt sida om de inte får plats.
    if (y + 200 > PAGE_BOTTOM + 60) {
      doc.addPage();
      y = M;
    }

    // --- Summering ---
    y += 12;
    const sumX = M + 300;
    const sumW = W - M - sumX;
    // Beskattningsunderlag och moms per momssats (ML 17 kap. 24 §) — en rad
    // per sats om raderna har olika satser, annars som förut.
    const byRate = new Map<number, { net: number; vat: number }>();
    for (const line of snapshot.lines) {
      const g = byRate.get(line.vatRateBp) ?? { net: 0, vat: 0 };
      g.net += line.lineTotalOre;
      g.vat += Math.round((line.lineTotalOre * line.vatRateBp) / 10000);
      byRate.set(line.vatRateBp, g);
    }
    const rateLabel = (bp: number) => `${String(bp / 100).replace(".", ",")} %`;
    const sums: [string, string, boolean][] =
      byRate.size > 1
        ? [
            ...[...byRate.entries()].flatMap(([bp, g]): [string, string, boolean][] => [
              [`Netto ${rateLabel(bp)}`, pdfMoney(signed(snapshot, g.net)), false],
              [`Moms ${rateLabel(bp)}`, pdfMoney(signed(snapshot, g.vat)), false],
            ]),
            [credit ? "Krediterat belopp" : "Att betala", pdfMoney(signed(snapshot, snapshot.totalOre)), true],
          ]
        : [
            ["Netto", pdfMoney(signed(snapshot, snapshot.subtotalOre)), false],
            [`Moms ${rateLabel(snapshot.lines[0]?.vatRateBp ?? 1200)}`, pdfMoney(signed(snapshot, snapshot.vatOre)), false],
            [credit ? "Krediterat belopp" : "Att betala", pdfMoney(signed(snapshot, snapshot.totalOre)), true],
          ];
    for (const [label, value, bold] of sums) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(BROWN);
      doc.text(label, sumX, y, { width: 100 });
      doc.text(value, sumX + 100, y, { width: sumW - 100, align: "right" });
      y += bold ? 20 : 16;
      if (label.startsWith("Moms") && [...byRate.keys()].pop() !== undefined && label === `Moms ${rateLabel([...byRate.keys()].pop()!)}`) {
        doc.moveTo(sumX, y - 4).lineTo(W - M, y - 4).lineWidth(1).stroke(BROWN);
        y += 4;
      }
    }

    // --- Betalningsinformation ---
    y += 16;
    doc.rect(M, y, CONTENT_W, 66).fill(LIGHT_BG);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text(credit ? "KREDITERING" : "BETALNINGSINFORMATION", M + 12, y + 10);
    doc.font("Helvetica").fontSize(9.5).fillColor(BROWN);
    if (credit) {
      doc.text(`Denna kreditfaktura krediterar faktura ${snapshot.creditsInvoiceNumber} i sin helhet.`, M + 12, y + 24);
      doc.text("Fakturan ska inte betalas. Är den redan betald återbetalas beloppet.", M + 12, y + 38);
      doc.text(`Kreditdatum: ${(snapshot.invoiceDate)}`, M + 12, y + 52);
    } else {
      // Platshållare ("[EJ VERIFIERAT …]") får aldrig hamna på en kundfaktura —
      // saknas verifierat bankgiro skrivs en neutral rad tills värdet är satt.
      doc.text(
        isVerifiedValue(snapshot.seller.bankgiro)
          ? `Bankgiro: ${snapshot.seller.bankgiro}`
          : "Betalningsuppgifter meddelas separat.",
        M + 12,
        y + 24
      );
      doc.text(
        `Ange fakturanummer ${invoiceNumber} som referens vid betalning.`,
        M + 12,
        y + 38
      );
      doc.text(
        `Förfallodatum: ${(snapshot.dueDate)}. Efter förfallodagen debiteras dröjsmålsränta enligt räntelagen.`,
        M + 12,
        y + 52,
        { width: CONTENT_W - 24, lineBreak: false }
      );
    }

    // --- Sidfot på varje sida ---
    const footY = 780;
    const s = snapshot.seller;
    const footerParts = [
      s.companyName,
      `Org.nr ${s.orgNumber}`,
      `${s.address}, ${s.postalCode} ${s.city}`,
      isVerifiedValue(s.email) ? s.email : "",
      isVerifiedValue(s.phone) ? s.phone : "",
    ].filter(Boolean);
    // F-skatt-texten är också en verksamhetsuppgift — aldrig platshållare på kundfaktura.
    const footerParts2 = [
      isVerifiedValue(s.vatNumber) ? `Momsreg.nr ${s.vatNumber}` : "",
      isVerifiedValue(s.fSkatt) ? s.fSkatt : "",
    ].filter(Boolean);
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(M, footY - 10).lineTo(W - M, footY - 10).lineWidth(0.5).stroke(BORDER);
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(footerParts.join(" · "), M, footY, { width: CONTENT_W, align: "center", lineBreak: false });
      doc.text(footerParts2.join(" · "), M, footY + 11, { width: CONTENT_W, align: "center", lineBreak: false });
      if (range.count > 1) {
        doc.text(`Sida ${i - range.start + 1} av ${range.count}`, M, footY + 22, { width: CONTENT_W, align: "center", lineBreak: false });
      }
    }

    doc.end();
  });
}
