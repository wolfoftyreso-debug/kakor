import { prisma } from "@/lib/db";
import { todayInStockholm } from "@/lib/dates";

/**
 * Förfallna, obetalda fakturor för ett organisationsnummer (exkl. en given order).
 * Verksamhetens princip: inga nya leveranser förrän en förfallen faktura är
 * reglerad. Systemet stoppar inte automatiskt – det visar flaggan i admin och
 * i orderaviseringen så att beslutet tas av en människa.
 */
export async function overdueInvoicesFor(orgNumber: string, excludeOrderId?: string) {
  const today = todayInStockholm();
  return prisma.invoice.findMany({
    where: {
      status: "UNPAID",
      dueDate: { lt: today },
      order: { orgNumber, status: { not: "CANCELLED" }, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
    },
    select: {
      invoiceNumber: true,
      dueDate: true,
      totalOre: true,
      creditNotes: { select: { totalOre: true } },
      order: { select: { orderNumber: true } },
    },
    orderBy: { dueDate: "asc" },
  }).then((rows) =>
    rows.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      dueDate: r.dueDate,
      totalOre: Math.max(0, r.totalOre + r.creditNotes.reduce((s, c) => s + c.totalOre, 0)),
      order: r.order,
    }))
  );
}

/** Organisationsnummer med minst en förfallen obetald faktura. */
export async function overdueOrgNumbers(now = new Date()): Promise<Set<string>> {
  const today = todayInStockholm(now);
  const rows = await prisma.invoice.findMany({
    where: { status: "UNPAID", dueDate: { lt: today }, order: { status: { not: "CANCELLED" } } },
    select: { order: { select: { orgNumber: true } } },
  });
  return new Set(rows.map((r) => r.order.orgNumber));
}
