import { parseBackup } from './backup.js';

// Liest eine Sicherungsdatei (Text) und ersetzt die Daten über `replace`. Wirft nie.
export async function restoreFromText(text, replace) {
  const parsed = parseBackup(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const d = parsed.data;
  try {
    await replace(d);
  } catch {
    return { ok: false, error: 'Der Import ist fehlgeschlagen. Deine bisherigen Daten sind unverändert.' };
  }
  return { ok: true, counts: { meals: d.meals.length, products: d.products.length, weights: d.weights.length } };
}
