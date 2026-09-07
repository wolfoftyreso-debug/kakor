// Svenska organisationsnummer har Luhn-kontrollsiffra – ett formatriktigt men
// påhittat nummer (556677-8899 är t.ex. ogiltigt) ska inte kunna faktureras.
// Egen modul utan beroenden så att kassan kan validera direkt i webbläsaren.
export function isValidOrgNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
