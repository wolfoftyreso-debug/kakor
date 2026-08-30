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
  lines: {
    productName: string;
    weightKg: number; // antal enheter
    /** "kg" | "paket". Saknas i äldre snapshots — tolkas då som "kg". */
    unit?: string;
    unitPricePerKgOre: number;
    vatRateBp: number;
    lineTotalOre: number;
  }[];
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
  currency: string;
  invoiceDate: string; // ISO-datum
  dueDate: string; // ISO-datum
  paymentTermsDays: number;
}

export function parseSnapshot(json: string): InvoiceSnapshot {
  return JSON.parse(json) as InvoiceSnapshot;
}
