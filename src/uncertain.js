// Felder, bei denen die KI melden darf, dass sie den Wert vom Etikett nicht sicher lesen konnte.
// Reihenfolge = Reihenfolge der Anzeige. Das bewertet nie das Essen, nur die Lesesicherheit.
export const UNCERTAIN_FIELDS = {
  basis: 'Bezugsgröße',
  servingGrams: 'Gramm pro Portion',
  kcal: 'Kalorien',
  protein: 'Protein',
  carbs: 'Kohlenhydrate',
  fat: 'Fett',
  fiber: 'Ballaststoffe',
  sugar: 'Zucker',
};

export function cleanUncertain(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((k) => typeof k === 'string' && Object.hasOwn(UNCERTAIN_FIELDS, k)))];
}

export const describeUncertain = (set) => Object.keys(UNCERTAIN_FIELDS).filter((k) => set.has(k)).map((k) => UNCERTAIN_FIELDS[k]).join(', ');
