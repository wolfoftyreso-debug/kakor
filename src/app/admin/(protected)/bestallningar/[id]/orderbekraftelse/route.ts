import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/session";
import { isFirstPartyNavigation } from "@/lib/auth/request-guard";
import { prisma } from "@/lib/db";
import { renderOrderConfirmationPdf } from "@/lib/orders/confirmation-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Obehörig", { status: 401 });
  if (!isFirstPartyNavigation(_req.headers)) {
    return new NextResponse("Ogiltig förfrågan", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new NextResponse("Ogiltig order", { status: 400 });
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      invoice: { select: { invoiceNumber: true, dueDate: true } },
      subscription: { select: { number: true, frequency: true } },
    },
  });
  if (!order) return new NextResponse("Ordern finns inte", { status: 404 });
  const pdf = await renderOrderConfirmationPdf({
    orderNumber: order.orderNumber,
    email: order.email,
    invoiceEmail: order.invoiceEmail,
    companyName: order.companyName,
    orgNumber: order.orgNumber,
    contactName: order.contactName,
    phone: order.phone,
    reference: order.reference,
    deliveryAddress: order.deliveryAddress,
    deliveryPostalCode: order.deliveryPostalCode,
    deliveryCity: order.deliveryCity,
    deliveryInstruction: order.deliveryInstruction,
    deliveryDate: order.deliveryDate,
    subtotalOre: order.subtotalOre,
    vatOre: order.vatOre,
    totalOre: order.totalOre,
    items: order.items,
    invoice: order.invoice,
    subscription: order.subscription,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orderbekraftelse-${order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
