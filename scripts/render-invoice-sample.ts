import { mkdirSync, writeFileSync } from "node:fs";
import { invoiceConfig } from "../src/lib/config";
import { calculateTotals } from "../src/lib/money";
import { renderInvoicePdf } from "../src/lib/invoice/pdf";
import type { InvoiceSnapshot } from "../src/lib/invoice/snapshot";

const outDir = "/tmp/invoice-qa";
mkdirSync(outDir, { recursive: true });

const lines = [
  { productName: "Kolasnittar", weightKg: 3, unit: "kg" as const, unitPricePerKgOre: 29500, vatRateBp: 600, lineTotalOre: 88500 },
  { productName: "Mandelkubb", weightKg: 2, unit: "kg" as const, unitPricePerKgOre: 29500, vatRateBp: 600, lineTotalOre: 59000 },
  { productName: "Prova-på-paket", weightKg: 1, unit: "paket" as const, unitPricePerKgOre: 44500, vatRateBp: 600, lineTotalOre: 44500 },
];
const totals = calculateTotals(lines.map((l) => ({ netOre: l.lineTotalOre, vatRateBp: l.vatRateBp })));

const snapshot: InvoiceSnapshot = {
  seller: {
    companyName: invoiceConfig.companyName,
    orgNumber: invoiceConfig.orgNumber,
    address: invoiceConfig.address,
    postalCode: invoiceConfig.postalCode,
    city: invoiceConfig.city,
    email: invoiceConfig.email,
    phone: invoiceConfig.phone,
    bankgiro: invoiceConfig.bankgiro,
    vatNumber: invoiceConfig.vatNumber,
    fSkatt: invoiceConfig.fSkatt,
    iban: invoiceConfig.iban,
    bic: invoiceConfig.bic,
    intermediaryBic: invoiceConfig.intermediaryBic,
  },
  buyer: {
    companyName: "Granuddens Bygg AB",
    orgNumber: "556701-0018",
    contactName: "Greta Gran",
    invoiceEmail: "faktura@granudden.se",
    billingAddress: "Granuddsvägen 12, 135 40 Tyresö",
    reference: "Kostnadsställe Fika",
  },
  orderNumber: "SB-100001",
  deliveryDate: "2026-09-17",
  deliveryAddress: "Granuddsvägen 12, 135 40 Tyresö",
  lines,
  subtotalOre: totals.subtotalOre,
  vatOre: totals.vatOre,
  totalOre: totals.totalOre,
  currency: "SEK",
  invoiceDate: "2026-09-12",
  dueDate: "2026-10-17",
  paymentTermsDays: 30,
};

async function main() {
  const pdf = await renderInvoicePdf(snapshot, "10001");
  const path = `${outDir}/faktura-10001.pdf`;
  writeFileSync(path, pdf);
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (b: Buffer) => Promise<{ text: string }>;
  const text = (await pdfParse(pdf)).text.replace(/\s+/g, " ");
  const required = [
    "FAKTURA",
    "10001",
    "Landvex AB",
    "559141-7042",
    "SE559141704201",
    "Godkänd för F-skatt",
    "Granuddens Bygg AB",
    "Kolasnittar",
    "IBAN: LT71 3250 0093 1434 0371",
    "REVOLT21",
    "BARCGB22",
    "6 %",
    "info@sockerbagaren.se",
    "Ange fakturanummer 10001",
  ];
  const missing = required.filter((s) => !text.includes(s));
  if (missing.length) {
    console.error("Saknas i PDF:", missing);
    process.exit(1);
  }
  console.log(JSON.stringify({ path, bytes: pdf.length, totalOre: totals.totalOre, vatOre: totals.vatOre, ok: true }));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
