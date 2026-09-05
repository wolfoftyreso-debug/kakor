import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { parseSnapshot, type InvoiceSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { sendEmail } from "@/lib/email";
import { calculateTotals, formatOre } from "@/lib/money";
import { siteConfig } from "@/lib/config";
import { todayInStockholm, toISODate } from "@/lib/dates";
import { qtyLabel } from "@/lib/units";

// Kreditfakturor. Nummer ur samma obrutna fakturaserie, eget snapshot
// (krediterade rader + referens till fakturan), egen nedladdningslänk.
//
// Två former:
//   FULL    — krediterar allt som återstår på fakturan; fakturan blir CREDITED.
//   PARTIAL — krediterar valda rader/mängder (fel sort, saknad vikt, reklamation);
//             fakturan står kvar och "att betala" minskar med kreditbeloppet.
// En faktura kan ha flera kreditfakturor. Det som redan krediterats per rad
// räknas av (sourceLineIndex) så att en rad aldrig krediteras två gånger.
// Databasdelen kan köras inne i anroparens transaktion (avbrytande +
// kreditering atomiskt); mejlet skickas efter commit.

type Tx = Prisma.TransactionClient;

export type CreditLineRequest = { lineIndex: number; qty: number };

export class CreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditError";
  }
}

/** Återstående (ej krediterad) mängd per rad i originalfakturan. */
export function remainingByLine(
  invoiceSnapshotJson: string,
  creditNotes: { kind: string; snapshotJson: string }[]
): { line: InvoiceSnapshot["lines"][number]; remaining: number }[] {
  const original = parseSnapshot(invoiceSnapshotJson);
  const remaining = original.lines.map((l) => l.weightKg);
  for (const note of creditNotes) {
    const credit = parseSnapshot(note.snapshotJson);
    const indexed = credit.lines.some((l) => l.sourceLineIndex !== undefined);
    if (!indexed) {
      // Äldre kreditfaktura utan radindex = hela fakturan krediterad.
      if (note.kind === "FULL") remaining.fill(0);
      continue;
    }
    for (const l of credit.lines) {
      const i = l.sourceLineIndex!;
      if (i >= 0 && i < remaining.length) remaining[i] = Math.max(0, remaining[i] - l.weightKg);
    }
  }
  return original.lines.map((line, i) => ({ line, remaining: remaining[i] }));
}

export async function issueCreditNoteInTx(
  tx: Tx,
  invoiceId: string,
  actor: string,
  opts: { lines?: CreditLineRequest[]; reason?: string } = {}
) {
  // Radlås: en UPDATE på fakturaraden håller andra krediteringar av samma
  // faktura väntande tills den här transaktionen är klar. Utan det kan två
  // adminflikar kreditera samma rad två gånger (båda läser samma "återstår").
  const locked = await tx.invoice.updateMany({ where: { id: invoiceId }, data: { updatedAt: new Date() } });
  if (locked.count !== 1) return null;
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { creditNotes: { orderBy: { createdAt: "asc" } } },
  });
  if (!invoice) return null;
  // Idempotent för hel kreditering: redan stängd faktura krediteras inte igen.
  if (invoice.status === "CREDITED") {
    if (opts.lines) throw new CreditError("Fakturan är redan krediterad i sin helhet");
    const existing = invoice.creditNotes.find((c) => c.kind === "FULL") ?? invoice.creditNotes.at(-1);
    return existing ? { ...existing, reused: true } : null;
  }

  const original = parseSnapshot(invoice.snapshotJson);
  const remaining = remainingByLine(invoice.snapshotJson, invoice.creditNotes);

  // Vilka rader/mängder krediteras?
  const requested: { index: number; qty: number }[] = opts.lines
    ? opts.lines.map(({ lineIndex, qty }) => {
        const r = remaining[lineIndex];
        if (!r) throw new CreditError("Ogiltig fakturarad");
        if (!Number.isInteger(qty) || qty < 1) throw new CreditError("Ange en mängd över 0");
        if (qty > r.remaining) {
          throw new CreditError(
            `Bara ${qtyLabel(r.remaining, r.line.unit ?? "kg")} återstår att kreditera på raden ${r.line.productName}`
          );
        }
        return { index: lineIndex, qty };
      })
    : remaining.filter((r) => r.remaining > 0).map((r, _i) => ({ index: remaining.indexOf(r), qty: r.remaining }));
  if (requested.length === 0) return null;
  const seen = new Set<number>();
  for (const r of requested) {
    if (seen.has(r.index)) throw new CreditError("Samma rad angiven två gånger");
    seen.add(r.index);
  }

  const lines = requested.map(({ index, qty }) => {
    const src = original.lines[index];
    return {
      productName: src.productName,
      weightKg: qty,
      unit: src.unit,
      unitPricePerKgOre: src.unitPricePerKgOre,
      vatRateBp: src.vatRateBp,
      lineTotalOre: qty * src.unitPricePerKgOre,
      sourceLineIndex: index,
    };
  });
  let totals = calculateTotals(lines.map((l) => ({ netOre: l.lineTotalOre, vatRateBp: l.vatRateBp })));
  // Stänger den här krediteringen fakturan?
  const closes = remaining.every((r) => {
    const req = requested.find((q) => q.index === remaining.indexOf(r));
    return r.remaining - (req?.qty ?? 0) === 0;
  });
  const kind = closes ? "FULL" : "PARTIAL";
  if (closes) {
    // Sista kreditnotan tar exakt det som återstår av fakturan — annars kan
    // flera delkrediteringar med egen öresavrundning summera till 1 öre mer
    // än fakturan (12 345 öre × 3 à 6 %: 3 × 741 = 2 223 mot fakturans 2 222).
    const prev = invoice.creditNotes.reduce(
      (s, c) => ({ sub: s.sub - c.subtotalOre, vat: s.vat - c.vatOre, tot: s.tot - c.totalOre }),
      { sub: 0, vat: 0, tot: 0 }
    );
    totals = {
      subtotalOre: Math.max(0, invoice.subtotalOre - prev.sub),
      vatOre: Math.max(0, invoice.vatOre - prev.vat),
      totalOre: Math.max(0, invoice.totalOre - prev.tot),
    };
  }

  const today = todayInStockholm();
  const snapshot: InvoiceSnapshot = {
    ...original,
    lines,
    subtotalOre: totals.subtotalOre,
    vatOre: totals.vatOre,
    totalOre: totals.totalOre,
    invoiceDate: toISODate(today),
    dueDate: toISODate(today),
    paymentTermsDays: 0,
    creditsInvoiceNumber: invoice.invoiceNumber,
    creditKind: kind,
    creditReason: opts.reason?.trim() || undefined,
  };
  const creditNumber = await nextNumber(tx, "invoice");
  const created = await tx.creditNote.create({
    data: {
      creditNumber,
      invoiceId: invoice.id,
      kind,
      issuedDate: today,
      snapshotJson: JSON.stringify(snapshot),
      subtotalOre: -totals.subtotalOre,
      vatOre: -totals.vatOre,
      totalOre: -totals.totalOre,
      downloadToken: randomBytes(24).toString("hex"),
    },
  });
  if (closes) await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CREDITED" } });
  const detail = lines.map((l) => `${l.productName} ${qtyLabel(l.weightKg, l.unit ?? "kg")}`).join(", ");
  await tx.orderEvent.create({
    data: {
      orderId: invoice.orderId,
      type: "CREDITED",
      message: closes
        ? `Kreditfaktura ${creditNumber} utfärdad — krediterar faktura ${invoice.invoiceNumber} (${formatOre(totals.totalOre)}).${opts.reason ? ` Anledning: ${opts.reason}` : ""}`
        : `Kreditfaktura ${creditNumber} utfärdad — delkreditering ${formatOre(totals.totalOre)} av faktura ${invoice.invoiceNumber} (${detail}).${opts.reason ? ` Anledning: ${opts.reason}` : ""}`,
      actor,
    },
  });
  return { ...created, reused: false };
}

/** Mejlar kreditfakturan (PDF + länk) till fakturamottagaren. Kastar aldrig. */
export async function sendCreditNoteEmail(creditNoteId: string): Promise<boolean> {
  const credit = await prisma.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { invoice: { include: { order: true, creditNotes: true } } },
  });
  if (!credit) return false;
  const invoice = credit.invoice;
  const creditedTotal = invoice.creditNotes.reduce((s, c) => s + c.totalOre, 0); // negativt
  const remainingToPay = Math.max(0, invoice.totalOre + creditedTotal);
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const pdf = await renderInvoicePdf(parseSnapshot(credit.snapshotJson), credit.creditNumber);
    attachments = [{ filename: `kreditfaktura-${credit.creditNumber}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch (e) {
    console.error("Kreditfaktura-PDF misslyckades:", e instanceof Error ? e.message.slice(0, 300) : e);
  }
  const full = credit.kind === "FULL";
  const text = full
    ? `Faktura ${invoice.invoiceNumber} (order ${invoice.order.orderNumber}) krediteras i sin helhet.

Kreditfaktura: ${credit.creditNumber}
Krediterat belopp: ${formatOre(-credit.totalOre)} inkl. moms
Ladda ner kreditfakturan: ${siteConfig.url}/faktura/${credit.downloadToken}

${invoice.status === "PAID" ? "Fakturan är betald — beloppet återbetalas." : "Fakturan ska inte betalas. Har den redan betalats återbetalas beloppet."}

Vänliga hälsningar
Sockerbagaren`
    : `Faktura ${invoice.invoiceNumber} (order ${invoice.order.orderNumber}) krediteras delvis.

Kreditfaktura: ${credit.creditNumber}
Krediterat belopp: ${formatOre(-credit.totalOre)} inkl. moms
Återstår att betala på fakturan: ${formatOre(remainingToPay)} inkl. moms${invoice.status === "PAID" ? " (fakturan är redan betald — det krediterade beloppet återbetalas)" : ` — förfallodatum ${toISODate(invoice.dueDate)} som tidigare`}
Ladda ner kreditfakturan: ${siteConfig.url}/faktura/${credit.downloadToken}

Vänliga hälsningar
Sockerbagaren`;
  return sendEmail({
    to: invoice.order.invoiceEmail,
    subject: `Kreditfaktura ${credit.creditNumber} — Sockerbagaren`,
    text,
    attachments,
    type: "CREDIT_NOTE",
    orderId: invoice.orderId,
  });
}

/** Fristående variant (egen transaktion + mejl). Idempotent för hel kreditering. */
export async function issueCreditNote(
  invoiceId: string,
  actor: string,
  opts: { lines?: CreditLineRequest[]; reason?: string } = {}
) {
  const credit = await prisma.$transaction((tx) => issueCreditNoteInTx(tx, invoiceId, actor, opts), { timeout: 15000 });
  if (credit) await sendCreditNoteEmail(credit.id);
  return credit;
}
