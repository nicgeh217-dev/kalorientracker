// Strichcodes (EAN/UPC): prüfen, vergleichen, Produkte finden und bei Open Food Facts nachschlagen.

// Prüfziffer nach EAN/UPC: Von rechts mit 1, 3, 1, 3 … gewichtet, die Summe muss durch 10 teilbar sein.
function checksumOk(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const d = Number(digits[digits.length - 1 - i]);
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

// Gibt den Code in einheitlicher Form (8 oder 13 Stellen) zurück, sonst null. UPC-A (12 Stellen) wird zu EAN-13.
export function normalizeBarcode(raw) {
  const digits = String(raw ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (!checksumOk(digits)) return null;
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 14) return digits.startsWith('0') ? digits.slice(1) : digits;
  return digits;
}

export function sameBarcode(a, b) {
  const x = normalizeBarcode(a);
  return x != null && x === normalizeBarcode(b);
}

export function findProductByBarcode(products, code) {
  const wanted = normalizeBarcode(code);
  if (!wanted) return null;
  return products.find((p) => p.barcode && normalizeBarcode(p.barcode) === wanted) ?? null;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
// Menge in Gramm aus einer Zahl oder einem Text wie '40' (Open Food Facts liefert beides).
const grams = (v) => { const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v; return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null; };
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// Open Food Facts -> Werte pro 100 g im Format der App. null, wenn nichts Brauchbares (Name und Kalorien) da ist.
export function parseOpenFoodFacts(json) {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments ?? {};
  const name = String(p.product_name_de || p.product_name || '').trim().slice(0, 80);
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n.energy_100g) != null) kcal = n.energy_100g / 4.184; // nur kJ angegeben
  if (!name || kcal == null) return null;
  return {
    name,
    basis: 'per100g',
    servingGrams: grams(p.serving_quantity) ?? grams(p.product_quantity), // Portion, sonst Packungsgröße (z. B. ein 40-g-Riegel)
    kcal: Math.round(kcal),
    protein: round1(num(n.proteins_100g)),
    carbs: round1(num(n.carbohydrates_100g)),
    fat: round1(num(n.fat_100g)),
    fiber: round1(num(n.fiber_100g)),
    sugar: round1(num(n.sugars_100g)),
  };
}

export async function lookupOpenFoodFacts(code, fetchFn = (...a) => fetch(...a)) {
  const barcode = normalizeBarcode(code);
  if (!barcode) return { ok: false, error: 'Das ist kein gültiger Strichcode.' };
  try {
    const res = await fetchFn(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_de,nutriments,serving_quantity,product_quantity`);
    if (res.status === 404) return { ok: false, notFound: true };
    if (!res.ok) return { ok: false, error: `Open Food Facts hat mit Fehler ${res.status} geantwortet.` };
    const label = parseOpenFoodFacts(await res.json());
    return label ? { ok: true, label } : { ok: false, notFound: true };
  } catch {
    return { ok: false, error: 'Keine Verbindung zum Internet oder zu Open Food Facts.' };
  }
}
