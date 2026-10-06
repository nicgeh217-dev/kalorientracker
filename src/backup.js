export function buildBackup(data, now) {
  const { geminiKey, ...settings } = data.settings ?? {};
  return {
    version: 1,
    exportedAt: now.toISOString(),
    products: data.products,
    meals: data.meals,
    weights: data.weights,
    settings,
  };
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function parseBackup(text) {
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  if (!isObj(b) || b.version !== 1) {
    return { ok: false, error: 'Das ist keine Kalorientracker-Sicherung (Version 1).' };
  }
  for (const k of ['products', 'meals', 'weights']) {
    if (!Array.isArray(b[k])) return { ok: false, error: `Feld "${k}" fehlt oder ist ungültig.` };
  }
  if (!isObj(b.settings)) return { ok: false, error: 'Feld "settings" fehlt oder ist ungültig.' };
  if (!b.products.every((p) => isObj(p) && typeof p.name === 'string')) {
    return { ok: false, error: 'Ein Produkt in der Datei ist ungültig.' };
  }
  if (!b.meals.every((m) => isObj(m) && typeof m.timestamp === 'string' && typeof m.dateKey === 'string')) {
    return { ok: false, error: 'Eine Mahlzeit in der Datei ist ungültig (Zeitstempel fehlt).' };
  }
  if (!b.weights.every((w) => isObj(w) && typeof w.date === 'string' && typeof w.kg === 'number' && Number.isFinite(w.kg))) {
    return { ok: false, error: 'Ein Gewichtseintrag in der Datei ist ungültig.' };
  }
  return { ok: true, data: { products: b.products, meals: b.meals, weights: b.weights, settings: b.settings } };
}
