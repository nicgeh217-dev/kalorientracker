// Tagesziele (kcal, Protein) als ganze Zahl. Leer = kein Ziel.
export function parseIntGoal(text, { min = 1, max = 9999 } = {}) {
  const t = String(text ?? '').trim();
  if (t === '') return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  return n >= min && n <= max ? { ok: true, value: n } : { ok: false };
}
