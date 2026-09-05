import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { isoDateSchema } from "@/lib/validation";
import { addDays, fromISODate, toISODate, todayInStockholm } from "@/lib/dates";

// Bokföringsexport: fakturor och kreditfakturor för en period som CSV
// (semikolon, decimalkomma, UTF-8 med BOM — öppnas direkt i svensk Excel och
// importeras i de flesta bokföringsprogram). Belopp per momssats så att
// konteringen 6/12/25 % blir rätt. Kreditfakturor har negativa belopp.
// Kräver inloggad admin — route handlers omfattas inte av layoutens skydd.

export const dynamic = "force-dynamic";

const RATES = [600, 1200, 2500] as const;

function kr(ore: number): string {
  return (ore / 100).toFixed(2).replace(".", ",");
}
function csvCell(v: string): string {
  // Formelinjektion: ett företagsnamn som "=HYPERLINK(...)" eller "-2+3|cmd"
  // får inte köras när kalkylprogrammet öppnar filen — neutralisera med
  // apostrof, som Excel/LibreOffice tolkar som text.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n\r']/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
function perRate(snapshotJson: string, sign: 1 | -1) {
  const net: Record<number, number> = { 600: 0, 1200: 0, 2500: 0 };
  const vat: Record<number, number> = { 600: 0, 1200: 0, 2500: 0 };
  try {
    for (const line of parseSnapshot(snapshotJson).lines) {
      const v = Math.round((line.lineTotalOre * line.vatRateBp) / 10000);
      // Produktschemat tillåter bara 6/12/25 % — andra satser kan inte förekomma.
      if (line.vatRateBp in net) {
        net[line.vatRateBp] += sign * line.lineTotalOre;
        vat[line.vatRateBp] += sign * v;
      }
    }
  } catch {
    /* korrupt snapshot — raden exporteras ändå med totaler */
  }
  return { net, vat };
}

export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return new NextResponse("Ej inloggad", { status: 401 });
  const params = req.nextUrl.searchParams;
  const today = todayInStockholm();
  // Svensk kalendermånad oavsett serverns tidszon.
  const defaultFrom = `${toISODate(today).slice(0, 7)}-01`;
  const fromParsed = isoDateSchema("Ogiltigt datum").safeParse(params.get("from") ?? defaultFrom);
  const toParsed = isoDateSchema("Ogiltigt datum").safeParse(params.get("to") ?? toISODate(today));
  if (!fromParsed.success || !toParsed.success) return new NextResponse("Ogiltigt datumintervall", { status: 400 });
  const from = fromISODate(fromParsed.data);
  const toExclusive = addDays(fromISODate(toParsed.data), 1);
  if (toExclusive <= from) return new NextResponse("Slutdatum före startdatum", { status: 400 });

  const [invoices, credits] = await Promise.all([
    prisma.invoice.findMany({
      where: { invoiceDate: { gte: from, lt: toExclusive } },
      include: { order: { select: { orderNumber: true, companyName: true, orgNumber: true, deliveryDate: true } } },
      orderBy: { invoiceNumber: "asc" },
    }),
    prisma.creditNote.findMany({
      where: { issuedDate: { gte: from, lt: toExclusive } },
      include: { invoice: { include: { order: { select: { orderNumber: true, companyName: true, orgNumber: true, deliveryDate: true } } } } },
      orderBy: { creditNumber: "asc" },
    }),
  ]);

  const header = [
    "Typ", "Nummer", "Datum", "Förfallodatum", "Leveransdag", "Ordernummer", "Kund", "Org.nr",
    "Netto 6 %", "Moms 6 %", "Netto 12 %", "Moms 12 %", "Netto 25 %", "Moms 25 %",
    "Netto totalt", "Moms totalt", "Totalt", "Status", "Betald", "Krediterar faktura",
  ];
  const rows: string[][] = [];
  for (const inv of invoices) {
    const r = perRate(inv.snapshotJson, 1);
    rows.push([
      "Faktura", inv.invoiceNumber, toISODate(inv.invoiceDate), toISODate(inv.dueDate), toISODate(inv.order.deliveryDate),
      inv.order.orderNumber, inv.order.companyName, inv.order.orgNumber,
      ...RATES.flatMap((bp) => [kr(r.net[bp]), kr(r.vat[bp])]),
      kr(inv.subtotalOre), kr(inv.vatOre), kr(inv.totalOre),
      inv.status === "PAID" ? "Betald" : inv.status === "CREDITED" ? "Krediterad" : "Obetald",
      inv.paidAt ? toISODate(inv.paidAt) : "", "",
    ]);
  }
  for (const c of credits) {
    const r = perRate(c.snapshotJson, -1);
    rows.push([
      c.kind === "FULL" ? "Kreditfaktura" : "Kreditfaktura (delvis)", c.creditNumber, toISODate(c.issuedDate), "",
      toISODate(c.invoice.order.deliveryDate), c.invoice.order.orderNumber, c.invoice.order.companyName, c.invoice.order.orgNumber,
      ...RATES.flatMap((bp) => [kr(r.net[bp]), kr(r.vat[bp])]),
      kr(c.subtotalOre), kr(c.vatOre), kr(c.totalOre), "Kredit", "", c.invoice.invoiceNumber,
    ]);
  }
  // Kronologiskt i nummerserien (faktura och kredit delar serie).
  rows.sort((a, b) => Number(a[1]) - Number(b[1]));

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sockerbagaren-fakturor-${fromParsed.data}_${toParsed.data}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
