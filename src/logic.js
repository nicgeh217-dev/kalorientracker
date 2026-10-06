const round1 = (n) => Math.round(n * 10) / 10;

function scaled(value, factor, digits1) {
  if (value == null) return null;
  const v = value * factor;
  return digits1 ? round1(v) : Math.round(v);
}

// Faktor, mit dem die Werte des Produkts multipliziert werden.
function factorFor(product, amount) {
  const { basis, servingGrams } = product;
  const { unit, value } = amount;
  if (basis === 'per100g') {
    if (unit === 'g') return value / 100;
    return servingGrams ? (value * servingGrams) / 100 : null;
  }
  if (unit === 'servings') return value;
  return servingGrams ? value / servingGrams : null;
}

export function scaleNutrition(product, amount) {
  const f = factorFor(product, amount);
  if (f == null) return { error: 'NO_SERVING_GRAMS' };
  return {
    kcal: scaled(product.kcal, f, false),
    protein: scaled(product.protein, f, true),
    carbs: scaled(product.carbs, f, true),
    fat: scaled(product.fat, f, true),
  };
}

export function dayTotals(meals) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const m of meals) {
    for (const k of Object.keys(t)) t[k] += m[k] ?? 0;
  }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

export function checkPlausibility(n) {
  const warnings = [];
  if (n.basis === 'per100g' && n.kcal != null && n.kcal > 900) {
    warnings.push('Mehr als 900 kcal pro 100 g ist ungewöhnlich hoch. Bitte Wert prüfen.');
  }
  if (n.kcal > 0 && n.protein != null && n.carbs != null && n.fat != null) {
    const fromMacros = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
    if (Math.abs(fromMacros - n.kcal) / n.kcal > 0.25) {
      warnings.push(`Protein, Kohlenhydrate und Fett ergeben ca. ${Math.round(fromMacros)} kcal, angegeben sind ${n.kcal}. Bitte Werte prüfen.`);
    }
  }
  return warnings;
}

export function localDateKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
