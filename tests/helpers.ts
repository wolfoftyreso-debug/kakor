// Giltiga svenska organisationsnummer (Luhn) för testfixturer.
export function orgNumber(base9: string): string {
  const digits = base9.replace(/\D/g, "").slice(0, 9).padStart(9, "5");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  const full = digits + String(check);
  return `${full.slice(0, 6)}-${full.slice(6)}`;
}
