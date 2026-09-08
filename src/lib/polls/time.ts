// datetime-local i admin anges i svensk tid. Konvertering till/från UTC via
// Intl så att sommartid/vintertid alltid blir rätt.
export function fromStockholmLocal(value: string): Date {
  const guess = new Date(`${value}:00.000Z`);
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asIfLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const offset = asIfLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function toStockholmLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}
