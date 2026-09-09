import { addDays } from "@/lib/dates";

/** Återstår att betala efter kreditfakturor (kreditbelopp är negativa). */
export function remainingOre(totalOre: number, creditNotes: { totalOre: number }[]): number {
  return Math.max(0, totalOre + creditNotes.reduce((s, c) => s + c.totalOre, 0));
}

export type AgingKey = "overdue" | "dueSoon" | "later";

/** Förfallet / förfaller inom `soonDays` dagar / senare. Bara obetalda. */
export function agingKey(dueDate: Date, today: Date, soonDays = 7): AgingKey {
  if (dueDate.getTime() < today.getTime()) return "overdue";
  if (dueDate.getTime() <= addDays(today, soonDays).getTime()) return "dueSoon";
  return "later";
}

export interface AgingSums {
  overdueCount: number;
  overdueOre: number;
  dueSoonCount: number;
  dueSoonOre: number;
  laterCount: number;
  laterOre: number;
}

export function emptyAging(): AgingSums {
  return { overdueCount: 0, overdueOre: 0, dueSoonCount: 0, dueSoonOre: 0, laterCount: 0, laterOre: 0 };
}

export function addToAging(sums: AgingSums, key: AgingKey, ore: number): void {
  if (key === "overdue") {
    sums.overdueCount += 1;
    sums.overdueOre += ore;
  } else if (key === "dueSoon") {
    sums.dueSoonCount += 1;
    sums.dueSoonOre += ore;
  } else {
    sums.laterCount += 1;
    sums.laterOre += ore;
  }
}
