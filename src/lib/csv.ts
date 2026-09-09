/** Cell i svensk CSV (semikolon). Neutraliserar formelinjektion i Excel/LibreOffice. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n\r']/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
