// Momssatser i baspunkter (600 = 6 %). Livsmedel har tillfälligt sänkt moms
// 2026-04-01 till och med 2027-12-31 (riksdagens beslut 2025/26:SkU9);
// därefter gäller 12 % igen. Restaurang- och cateringtjänster ligger kvar på
// 12 % hela tiden. Satsen lagras per produkt och ändras i admin → Produkter;
// koden räknar aldrig om historiska fakturor.

export const FOOD_VAT_RATE_BP = 600;
export const FOOD_VAT_ORDINARY_BP = 1200;
export const FOOD_VAT_TEMP_END = "2027-12-31"; // sista dagen med 6 %

/** Påminnelse till admin om att momssatsen är tillfällig. */
export function foodVatNotice(todayIso: string, productsAtTempRate: number): { urgent: boolean; text: string } | null {
  if (productsAtTempRate === 0) return null;
  const urgent = todayIso >= "2027-12-01";
  if (todayIso > FOOD_VAT_TEMP_END) {
    return {
      urgent: true,
      text: `Den tillfälliga livsmedelsmomsen på 6 % upphörde ${FOOD_VAT_TEMP_END}. ${productsAtTempRate} produkt(er) ligger fortfarande på 6 % — ändra till 12 % under Produkter.`,
    };
  }
  return {
    urgent,
    text: `${productsAtTempRate} produkt(er) har 6 % moms (tillfälligt sänkt livsmedelsmoms t.o.m. ${FOOD_VAT_TEMP_END}). Från 2028-01-01 gäller 12 % igen — ändra under Produkter.`,
  };
}
