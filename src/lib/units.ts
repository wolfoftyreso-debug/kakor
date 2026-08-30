// Försäljningsenheter. Lösviktsprodukter säljs per helt kilo ("kg"),
// styckvaror per paket ("paket" — t.ex. prova-på-paketet på 1,5 kg).
// All beloppsmatematik är antal × á-pris oavsett enhet; det här är enbart
// presentation + sanna viktsummor.

export type SaleUnit = "kg" | "paket";

export function unitLabel(unit: string): string {
  return unit === "paket" ? "paket" : "kg";
}

/** "3 kg", "1 paket", "2 paket" */
export function qtyLabel(qty: number, unit: string): string {
  return `${qty} ${unitLabel(unit)}`;
}

/** Prissuffix: "/kg" eller "/paket". */
export function priceSuffix(unit: string): string {
  return unit === "paket" ? "/paket" : "/kg";
}

/** Radens vikt i gram: lösvikt = antal kilo, paket = antal × paketvikt. */
export function lineWeightGrams(qty: number, unit: string, packageWeightGrams: number): number {
  return unit === "paket" ? qty * packageWeightGrams : qty * 1000;
}

/** "1,5 kg" / "3 kg" — svensk decimalkomma, utan onödiga decimaler. */
export function formatWeightKg(grams: number): string {
  const kg = grams / 1000;
  const text = Number.isInteger(kg) ? String(kg) : kg.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
  return `${text} kg`;
}
