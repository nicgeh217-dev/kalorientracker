// Zeigt die "Neu hier oder zurück?"-Karte, solange die App leer wirkt.
// Ein gesetzter Gemini-Key allein zählt nicht: nach einem Datenverlust fehlen genau die Einträge.
export function shouldShowWelcome({ products = [], meals = [], weights = [], settings = {} }) {
  if (settings.welcomeDismissed) return false;
  if (meals.length || products.length || weights.length) return false;
  return !(settings.calorieGoal || settings.pet || settings.calcProfile);
}
