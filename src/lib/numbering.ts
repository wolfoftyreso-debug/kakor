import type { Prisma } from "@prisma/client";

// Nummerserier. Dokumenterad serie:
//  - Ordernummer:  SB-100001, SB-100002, ... (prefix SB-, start 100001)
//  - Fakturanummer: 10001, 10002, ...        (ren löpnummerserie, start 10001)
//  - Prenumeration: PREN-1001, PREN-1002, ...
// Uppräkning sker atomiskt inne i samma transaktion som skapandet,
// så att nummer aldrig dubbleras eller hoppas över vid samtidiga anrop.

const SERIES = {
  order: { name: "order", start: 100000, format: (n: number) => `SB-${n}` },
  invoice: { name: "invoice", start: 10000, format: (n: number) => String(n) },
  subscription: { name: "subscription", start: 1000, format: (n: number) => `PREN-${n}` },
} as const;

export async function nextNumber(
  tx: Prisma.TransactionClient,
  series: keyof typeof SERIES
): Promise<string> {
  const { name, start, format } = SERIES[series];
  // Upsert + atomisk increment; raw-fri och säker i transaktion.
  await tx.counter.upsert({
    where: { name },
    create: { name, value: start },
    update: {},
  });
  const updated = await tx.counter.update({
    where: { name },
    data: { value: { increment: 1 } },
  });
  return format(updated.value);
}
