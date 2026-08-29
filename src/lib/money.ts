// Alla belopp hanteras i öre (heltal). Moms anges i baspunkter (1200 = 12 %).

export function formatOre(ore: number, opts?: { withCurrency?: boolean }): string {
  const kr = ore / 100;
  const formatted = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: ore % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(kr);
  return opts?.withCurrency === false ? formatted : `${formatted} kr`;
}

export interface VatLine {
  netOre: number;
  vatRateBp: number;
}

/** Moms per rad, avrundad per rad (öresavrundning). */
export function vatForLine(netOre: number, vatRateBp: number): number {
  return Math.round((netOre * vatRateBp) / 10000);
}

export interface OrderTotals {
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
}

export function calculateTotals(lines: VatLine[]): OrderTotals {
  const subtotalOre = lines.reduce((sum, l) => sum + l.netOre, 0);
  const vatOre = lines.reduce((sum, l) => sum + vatForLine(l.netOre, l.vatRateBp), 0);
  return { subtotalOre, vatOre, totalOre: subtotalOre + vatOre };
}
