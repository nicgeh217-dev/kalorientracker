import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBarcode, sameBarcode, findProductByBarcode, parseOpenFoodFacts, lookupOpenFoodFacts } from '../src/barcode.js';

test('normalizeBarcode: gültige EAN-13 bleibt, Leerzeichen/Bindestriche werden entfernt', () => {
  assert.equal(normalizeBarcode('4006381333931'), '4006381333931');
  assert.equal(normalizeBarcode(' 4006-3813 33931 '), '4006381333931');
});

test('normalizeBarcode: UPC-A (12 Stellen) wird zu EAN-13, EAN-8 bleibt', () => {
  assert.equal(normalizeBarcode('036000291452'), '0036000291452');
  assert.equal(normalizeBarcode('96385074'), '96385074');
});

test('normalizeBarcode: falsche Prüfziffer, falsche Länge, Buchstaben, leer ergeben null', () => {
  assert.equal(normalizeBarcode('4006381333932'), null);
  assert.equal(normalizeBarcode('12345'), null);
  assert.equal(normalizeBarcode('ABCDEFGHIJKLM'), null);
  assert.equal(normalizeBarcode(''), null);
  assert.equal(normalizeBarcode(null), null);
});

test('normalizeBarcode: koreanische Codes (880…) werden erkannt', () => {
  assert.equal(normalizeBarcode('8801073210080'), '8801073210080'); // Prüfziffer stimmt
});

test('sameBarcode: UPC-A und derselbe Code als EAN-13 sind gleich', () => {
  assert.equal(sameBarcode('036000291452', '0036000291452'), true);
  assert.equal(sameBarcode('4006381333931', '8801073210080'), false);
  assert.equal(sameBarcode('x', 'x'), false);
});

test('findProductByBarcode: findet nach normalisiertem Code, sonst null', () => {
  const products = [{ id: 1, name: 'A' }, { id: 2, name: 'Kimbap', barcode: '8801073210080' }];
  assert.equal(findProductByBarcode(products, '8801073210080').id, 2);
  assert.equal(findProductByBarcode(products, '4006381333931'), null);
  assert.equal(findProductByBarcode(products, 'quatsch'), null);
});

const off = (extra = {}) => ({
  status: 1,
  product: {
    product_name: 'Haselnusscreme', product_name_de: 'Nuss-Nougat-Creme',
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 3.4, sugars_100g: 56.3 },
    ...extra,
  },
});

test('parseOpenFoodFacts: pro 100 g mit allen Werten, deutscher Name hat Vorrang', () => {
  assert.deepEqual(parseOpenFoodFacts(off()), {
    name: 'Nuss-Nougat-Creme', basis: 'per100g', servingGrams: null,
    kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: 3.4, sugar: 56.3,
  });
});

test('parseOpenFoodFacts: nur kJ vorhanden wird in kcal umgerechnet', () => {
  const r = parseOpenFoodFacts({ status: 1, product: { product_name: 'X', nutriments: { energy_100g: 2255 } } });
  assert.equal(r.kcal, 539);
  assert.equal(r.protein, null);
});

test('parseOpenFoodFacts: nicht gefunden, ohne Kalorien oder ohne Namen ergibt null', () => {
  assert.equal(parseOpenFoodFacts({ status: 0 }), null);
  assert.equal(parseOpenFoodFacts(null), null);
  assert.equal(parseOpenFoodFacts({ status: 1, product: { product_name: 'X', nutriments: {} } }), null);
  assert.equal(parseOpenFoodFacts({ status: 1, product: { nutriments: { 'energy-kcal_100g': 100 } } }), null);
});

test('parseOpenFoodFacts: negative oder unsinnige Werte werden null, langer Name wird gekürzt', () => {
  const r = parseOpenFoodFacts(off({ product_name_de: 'N'.repeat(200), nutriments: { 'energy-kcal_100g': 100, fat_100g: -4, proteins_100g: 'viel' } }));
  assert.equal(r.name.length, 80);
  assert.equal(r.fat, null);
  assert.equal(r.protein, null);
});

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('lookupOpenFoodFacts: Treffer, nicht gefunden, Netzwerkfehler', async () => {
  let url;
  const hit = await lookupOpenFoodFacts('4006381333931', async (u) => { url = u; return reply(200, off()); });
  assert.equal(hit.ok, true);
  assert.equal(hit.label.name, 'Nuss-Nougat-Creme');
  assert.match(url, /api\/v2\/product\/4006381333931/);
  assert.deepEqual(await lookupOpenFoodFacts('4006381333931', async () => reply(404, { status: 0 })), { ok: false, notFound: true });
  assert.deepEqual(await lookupOpenFoodFacts('4006381333931', async () => reply(200, { status: 1, product: { product_name: 'X', nutriments: {} } })), { ok: false, notFound: true });
  const net = await lookupOpenFoodFacts('4006381333931', async () => { throw new TypeError('offline'); });
  assert.equal(net.ok, false);
  assert.match(net.error, /Internet/);
});

test('lookupOpenFoodFacts: ungültiger Code ruft das Netz nicht', async () => {
  let called = false;
  const r = await lookupOpenFoodFacts('123', async () => { called = true; return reply(200, {}); });
  assert.equal(r.ok, false);
  assert.equal(called, false);
});
