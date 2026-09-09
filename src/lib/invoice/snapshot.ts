import { z } from "zod";
// Fakturans ekonomiska snapshot. En utfärdad faktura är ett historiskt
// dokument: allt som behövs för att återge den lagras här vid utfärdandet.
// PDF och vyer renderas ENBART från denna struktur.

export interface InvoiceSnapshot {
  seller: {
    companyName: string;
    orgNumber: string;
    address: string;
    postalCode: string;
    city: string;
    email: string;
    phone: string;
    bankgiro: string;
    vatNumber: string;
    fSkatt: string;
    /** Revolut LT-IBAN. Tom i äldre snapshots. */
    iban?: string;
    bic?: string;
    intermediaryBic?: string;
  };
  buyer: {
    companyName: string;
    orgNumber: string;
    contactName: string;
    invoiceEmail: string;
    billingAddress: string; // fullständig fakturaadress (rad, postnr, ort)
    reference: string;
  };
  orderNumber: string;
  deliveryDate: string; // ISO-datum
  /** Leveransadress (rad, postnr, ort) – köpare med flera driftsställen behöver den på fakturan. */
  deliveryAddress?: string;
  /** Prenumerationsgenererad order: prenumerationsnumret (avtalsreferens på fakturan). */
  subscriptionNumber?: string;
  lines: {
    productName: string;
    weightKg: number; // antal enheter
    /** "kg" | "paket". Saknas i äldre snapshots – tolkas då som "kg". */
    unit?: string;
    unitPricePerKgOre: number;
    vatRateBp: number;
    lineTotalOre: number;
    /** Kreditfakturor: index på raden i originalfakturan som krediteras. */
    sourceLineIndex?: number;
  }[];
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
  currency: string;
  invoiceDate: string; // ISO-datum
  dueDate: string; // ISO-datum
  paymentTermsDays: number;
  /** Endast på kreditfakturor: numret på fakturan som krediteras. */
  creditsInvoiceNumber?: string;
  /** Endast på kreditfakturor: FULL (stänger fakturan) eller PARTIAL (delkreditering). */
  creditKind?: "FULL" | "PARTIAL";
  /** Endast på kreditfakturor: anledning (visas på PDF:en). */
  creditReason?: string;
  /** Endast på kreditfakturor: vad som återstår att betala på originalfakturan efter denna kreditering. */
  remainingToPayOre?: number;
  /** Endast på kreditfakturor: originalfakturans belopp och datum. */
  creditedInvoiceTotalOre?: number;
  creditedInvoiceDate?: string;
}

// Validerat vid läsning: skyddar PDF-renderingen mot schemadrift och
// korrupt lagrad JSON (fel upptäcks som ett tydligt fel, inte en trasig PDF).
// Parternas identitet ska aldrig tyst bli tom sträng – korrupt data ska ge ett fel.
const str = z.string();
const opt = z.string().catch("");
const snapshotSchema = z.object({
  seller: z.object({
    companyName: str,
    orgNumber: str,
    address: str,
    postalCode: str,
    city: str,
    email: opt,
    phone: opt,
    bankgiro: opt,
    vatNumber: opt,
    fSkatt: opt,
    iban: opt,
    bic: opt,
    intermediaryBic: opt,
  }),
  buyer: z.object({
    companyName: str,
    orgNumber: str,
    contactName: opt,
    invoiceEmail: opt,
    billingAddress: str,
    reference: opt,
  }),
  orderNumber: str,
  deliveryDate: str,
  deliveryAddress: z.string().optional(),
  subscriptionNumber: z.string().optional(),
  lines: z.array(
    z.object({
      productName: str,
      weightKg: z.number(),
      unit: z.string().optional(),
      unitPricePerKgOre: z.number().int(),
      vatRateBp: z.number().int(),
      lineTotalOre: z.number().int(),
      sourceLineIndex: z.number().int().optional(),
    })
  ),
  subtotalOre: z.number().int(),
  vatOre: z.number().int(),
  totalOre: z.number().int(),
  currency: str,
  invoiceDate: str,
  dueDate: str,
  paymentTermsDays: z.number().int(),
  creditsInvoiceNumber: z.string().optional(),
  creditKind: z.enum(["FULL", "PARTIAL"]).optional(),
  creditReason: z.string().optional(),
  remainingToPayOre: z.number().int().optional(),
  creditedInvoiceTotalOre: z.number().int().optional(),
  creditedInvoiceDate: z.string().optional(),
});

export function parseSnapshot(json: string): InvoiceSnapshot {
  return snapshotSchema.parse(JSON.parse(json));
}
