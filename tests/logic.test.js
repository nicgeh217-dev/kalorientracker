import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleNutrition, dayTotals, checkPlausibility, localDateKey } from '../src/logic.js';

const per100 = { basis: 'per100g', servingGrams: null, kcal: 250, protein: 10, carbs: 30, fat: 8 };
const perServ = { basis: 'perServing', servingGrams: 50, kcal: 300, protein: 12, carbs: 40, fat: null };

test('per100g: 150 g -> 375 kcal, Makros proportional', () => {
  assert.deepEqual(scaleNutrition(per100, { unit: 'g', value: 150 }),
    { kcal: 375, protein: 15, carbs: 45, fat: 12 });
});

test('perServing: 2 Portionen -> 600 kcal, null-Makro bleibt null', () => {
  assert.deepEqual(scaleNutrition(perServ, { unit: 'servings', value: 2 }),
    { kcal: 600, protein: 24, carbs: 80, fat: null });
});

test('perServing: 100 g bei servingGrams 50 -> 600 kcal', () => {
  assert.equal(scaleNutrition(perServ, { unit: 'g', value: 100 }).kcal, 600);
});

test('perServing in g ohne servingGrams -> NO_SERVING_GRAMS', () => {
  const p = { ...perServ, servingGrams: null };
  assert.deepEqual(scaleNutrition(p, { unit: 'g', value: 100 }), { error: 'NO_SERVING_GRAMS' });
});

test('per100g mit Portionen ohne servingGrams -> NO_SERVING_GRAMS', () => {
  assert.deepEqual(scaleNutrition(per100, { unit: 'servings', value: 1 }), { error: 'NO_SERVING_GRAMS' });
});

test('dayTotals zählt null als 0', () => {
  const t = dayTotals([
    { kcal: 100, protein: null, carbs: 10, fat: 2 },
    { kcal: 200, protein: 5, carbs: null, fat: null },
  ]);
  assert.deepEqual(t, { kcal: 300, protein: 5, carbs: 10, fat: 2 });
});

test('dayTotals leere Liste', () => {
  assert.deepEqual(dayTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('checkPlausibility: 950 kcal pro 100 g -> Warnung', () => {
  const w = checkPlausibility({ basis: 'per100g', kcal: 950, protein: 0, carbs: 0, fat: 105 });
  assert.ok(w.length >= 1);
});

test('checkPlausibility: Makros passen nicht zu kcal -> Warnung', () => {
  const w = checkPlausibility({ basis: 'perServing', kcal: 200, protein: 25, carbs: 25, fat: 22 });
  assert.equal(w.length, 1);
});

test('checkPlausibility: passende Werte -> leer', () => {
  assert.deepEqual(checkPlausibility({ basis: 'per100g', kcal: 250, protein: 10, carbs: 30, fat: 10 }), []);
});

test('checkPlausibility: fehlende Makros -> keine Makro-Warnung', () => {
  assert.deepEqual(checkPlausibility({ basis: 'per100g', kcal: 250, protein: null, carbs: 30, fat: 10 }), []);
});

test('localDateKey nutzt Ortszeit (Mitternacht)', () => {
  assert.equal(localDateKey(new Date(2026, 9, 6, 23, 50)), '2026-10-06');
  assert.equal(localDateKey(new Date(2026, 9, 7, 0, 10)), '2026-10-07');
});
