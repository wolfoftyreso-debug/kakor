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

// Allergener ska framhävas typografiskt I ingrediensförteckningen
// (förordning (EU) 1169/2011 art. 21.1 b). Ordlistan täcker de allergener
// som förekommer i sortimentet; nya sorter i admin bör hålla sig till dessa
// ord (eller listan utökas här).
const ALLERGEN_WORDS = [
  "vetemjöl", "vete", "smör", "mjölk", "ägg", "mandel", "mandlar", "hasselnöt", "hasselnötter",
  "nötter", "soja", "sojalecitin", "sesam", "jordnöt", "jordnötter", "havre", "råg", "korn",
];

/** Delar upp en ingrediensrad i segment där allergener markeras (för <strong>). */
export function highlightAllergens(ingredients: string): { text: string; allergen: boolean }[] {
  const pattern = new RegExp(`(${ALLERGEN_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  const out: { text: string; allergen: boolean }[] = [];
  let last = 0;
  for (const m of ingredients.matchAll(pattern)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: ingredients.slice(last, i), allergen: false });
    out.push({ text: m[0], allergen: true });
    last = i + m[0].length;
  }
  if (last < ingredients.length) out.push({ text: ingredients.slice(last), allergen: false });
  return out;
}
