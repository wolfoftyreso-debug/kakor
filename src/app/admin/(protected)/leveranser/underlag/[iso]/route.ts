import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/session";
import { fromISODate } from "@/lib/dates";
import { isWeekLockedStatus } from "@/lib/status";
import { buildSnapshot, parseSnapshot } from "@/lib/warehouse/snapshot";
import { prisma } from "@/lib/db";
import { renderDeliveryListPdf, renderPackingSlipsPdf, renderPickListPdf } from "@/lib/warehouse/pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ iso: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Obehörig", { status: 401 });
  const { iso } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new NextResponse("Ogiltigt datum", { status: 400 });
  const typ = req.nextUrl.searchParams.get("typ") ?? "lista";
  const date = fromISODate(iso);
  const week = await prisma.deliveryWeek.findUnique({ where: { deliveryDate: date } });
  const locked = isWeekLockedStatus(week?.status ?? "");
  const stored = week ? parseSnapshot(week.snapshotJson) : null;
  if (locked && !stored) {
    return new NextResponse("Låst vecka saknar snapshot – lås om eller öppna veckan i admin", { status: 409 });
  }
  const snapshot = stored ?? (await buildSnapshot(date, admin.email));

  let buf: Buffer;
  let filename: string;
  if (typ === "plock") {
    buf = await renderPickListPdf(snapshot);
    filename = `plocklista-${iso}.pdf`;
  } else if (typ === "sedlar") {
    buf = await renderPackingSlipsPdf(snapshot);
    filename = `leveranssedlar-${iso}.pdf`;
  } else {
    buf = await renderDeliveryListPdf(snapshot);
    filename = `leveranslista-${iso}.pdf`;
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
