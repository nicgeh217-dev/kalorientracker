// Orientierungswerte (keine Vorgabe): Anteile an den Kalorien, überschreibbar in den Einstellungen.
export const NUTRIENTS = [
  { id: 'protein', label: 'Eiweiß', color: '#ff6b57' },
  { id: 'carbs', label: 'Kohlenhydrate', color: '#ffb020' },
  { id: 'fat', label: 'Fett', color: '#4da3ff' },
  { id: 'fiber', label: 'Ballaststoffe', color: '#3ccf7a' },
  { id: 'sugar', label: 'Zucker', color: '#ff7ac0' },
];

const valid = (n) => Number.isFinite(n) && n > 0;

export function nutrientTargets({ kcal, proteinGoal = null, overrides = {} }) {
  if (!valid(kcal)) {
    // Ohne Kalorienziel gibt es nur, was du selbst festgelegt hast.
    const own = {};
    if (valid(proteinGoal)) own.protein = proteinGoal;
    for (const id of ['protein', 'carbs', 'fat', 'fiber', 'sugar']) if (valid(overrides?.[id])) own[id] = overrides[id];
    return Object.keys(own).length ? own : null;
  }
  const base = {
    protein: valid(proteinGoal) ? proteinGoal : Math.round((kcal * 0.2) / 4),
    carbs: Math.round((kcal * 0.5) / 4),
    fat: Math.round((kcal * 0.3) / 9),
    fiber: 30,
    sugar: Math.round((kcal * 0.1) / 4),
  };
  for (const id of Object.keys(base)) if (valid(overrides?.[id])) base[id] = overrides[id];
  return base;
}

export function ringProgress(value, target) {
  if (value == null || !valid(target)) return 0;
  return Math.max(0, Math.min(1, value / target));
}
