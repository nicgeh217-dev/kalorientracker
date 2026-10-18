import test from 'node:test';
import assert from 'node:assert/strict';
import { pickNotice } from '../src/notices.js';
import { defaultAmount, quickAmounts, amountForBasisChange } from '../src/amount.js';

test('Hinweise: nur einer, Priorität Warnung > Zielvorschlag > Sicherung', () => {
  const all = { fastLoss: { x: 1 }, suggestion: { x: 2 }, backup: { x: 3 } };
  assert.deepEqual(pickNotice(all), { kind: 'fastLoss', data: { x: 1 } });
  assert.deepEqual(pickNotice({ ...all, fastLoss: null }), { kind: 'suggestion', data: { x: 2 } });
  assert.deepEqual(pickNotice({ ...all, fastLoss: null, suggestion: null }), { kind: 'backup', data: { x: 3 } });
});

test('Hinweise: nichts anzuzeigen -> null', () => {
  assert.equal(pickNotice({ fastLoss: null, suggestion: null, backup: null }), null);
  assert.equal(pickNotice({}), null);
});

test('Standardmenge: pro 100 g -> 100 g, pro Portion -> 1 Portion', () => {
  assert.deepEqual(defaultAmount({ basis: 'per100g', servingGrams: null }), { unit: 'g', value: 100 });
  assert.deepEqual(defaultAmount({ basis: 'per100g', servingGrams: 50 }), { unit: 'g', value: 100 });
  assert.deepEqual(defaultAmount({ basis: 'perServing', servingGrams: null }), { unit: 'servings', value: 1 });
  assert.deepEqual(defaultAmount({ basis: null, servingGrams: null }), { unit: 'servings', value: 1 });
});

test('Schnelltasten: Portionen und Gramm', () => {
  assert.deepEqual(quickAmounts('servings'), [0.5, 1, 1.5, 2]);
  assert.deepEqual(quickAmounts('g'), [50, 100, 150, 200]);
});

test('Basis-Wechsel: Menge folgt, solange der Nutzer sie nicht angefasst hat', () => {
  const portion = { unit: 'servings', value: 1 };
  const gram = { unit: 'g', value: 100 };
  assert.deepEqual(amountForBasisChange({ basis: 'per100g', servingGrams: null, current: portion, touched: false }), gram);
  assert.deepEqual(amountForBasisChange({ basis: 'perServing', servingGrams: null, current: gram, touched: false }), portion);
});

test('Basis-Wechsel: angefasste Menge bleibt, ebenso wenn Portionsgröße bekannt ist', () => {
  const portion = { unit: 'servings', value: 2 };
  assert.deepEqual(amountForBasisChange({ basis: 'per100g', servingGrams: null, current: portion, touched: true }), portion);
  assert.deepEqual(amountForBasisChange({ basis: 'per100g', servingGrams: 50, current: { unit: 'servings', value: 1 }, touched: false }), { unit: 'servings', value: 1 });
});
