// Mengenangaben im Eintrags-Formular: sinnvolle Standardwerte und Schnelltasten.

const PORTION = { unit: 'servings', value: 1 };
const HUNDRED_GRAMS = { unit: 'g', value: 100 };

// Bei "pro 100 g" ist Gramm die natürliche Einheit (sonst fehlt die Portionsgröße), sonst eine Portion.
// Ist die Portion bekannt und klein (höchstens 100 g, z. B. ein 40-g-Riegel), ist eine Portion die richtige Voreinstellung.
// Große Packungen bleiben bei 100 g, damit nicht versehentlich eine ganze Tüte eingetragen wird.
export function defaultAmount({ basis, servingGrams = null }) {
  if (basis === 'per100g') return servingGrams > 0 && servingGrams <= 100 ? { ...PORTION } : { ...HUNDRED_GRAMS };
  return { ...PORTION };
}

export const quickAmounts = (unit) => (unit === 'g' ? [50, 100, 150, 200] : [0.5, 1, 1.5, 2]);

// Wechselt der Nutzer die Bezugsgröße, folgt die Menge mit, solange er sie nicht selbst angefasst hat
// und die Umrechnung ohne Portionsgröße sonst unmöglich wäre.
export function amountForBasisChange({ basis, servingGrams, current, touched }) {
  if (touched || servingGrams) return current;
  if (basis === 'per100g' && current.unit === 'servings') return { ...HUNDRED_GRAMS };
  if (basis === 'perServing' && current.unit === 'g') return { ...PORTION };
  return current;
}
