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
    select: { invoiceNumber: true, dueDate: true, totalOre: true, order: { select: { orderNumber: true } } },
    orderBy: { dueDate: "asc" },
  });
}
