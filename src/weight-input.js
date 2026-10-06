// "72,5" / "72.5" -> 72.5. Gültig sind 20-400 kg, alles andere -> null.
export function parseWeight(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 20 && n <= 400 ? n : null;
}
