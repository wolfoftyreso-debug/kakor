// Allergenraden lagras som fritext i admin ("Innehåller vete, smör (mjölk).
// Kan innehålla spår av mandel."). Alla ytor som visar den som chips måste
// tolka den PÅ SAMMA SÄTT — annars uppstår inkonsekvenser som "Smör (mjölk)."
// med kvarhängande punkt på en sida men inte en annan.
//
// Spår-allergener märks "(spår)" så att skillnaden mellan "innehåller" och
// "kan innehålla spår av" inte försvinner när meningen görs om till chips.

const TRACES_SEPARATOR = /kan innehålla spår av/i;

function parseList(part: string): string[] {
  return part
    .replace(/^\s*Innehåller\b/i, "")
    .split(",")
    .map((a) => a.trim().replace(/\.+$/, ""))
    .filter(Boolean)
    .map((a) => a.charAt(0).toUpperCase() + a.slice(1));
}

export function allergenChips(allergens: string): string[] {
  const [contains, traces = ""] = allergens.split(TRACES_SEPARATOR);
  return [...parseList(contains), ...parseList(traces).map((a) => `${a} (spår)`)];
}
