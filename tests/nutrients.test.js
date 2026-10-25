import test from 'node:test';
import assert from 'node:assert/strict';
import { NUTRIENTS, nutrientTargets, ringProgress } from '../src/nutrients.js';

test('Richtwerte aus kcal: 20 % Eiweiß, 50 % KH, 30 % Fett, 30 g Ballaststoffe, ≤10 % Zucker', () => {
  assert.deepEqual(nutrientTargets({ kcal: 2150 }), { protein: 108, carbs: 269, fat: 72, fiber: 30, sugar: 54 });
});

test('Proteinziel aus den Einstellungen hat Vorrang', () => {
  assert.equal(nutrientTargets({ kcal: 2150, proteinGoal: 120 }).protein, 120);
});

test('eigene Werte überschreiben, leere/ungültige Overrides werden ignoriert', () => {
  assert.equal(nutrientTargets({ kcal: 2150, overrides: { fiber: 25 } }).fiber, 25);
  assert.equal(nutrientTargets({ kcal: 2150, overrides: { fiber: null, fat: 0 } }).fiber, 30);
  assert.equal(nutrientTargets({ kcal: 2150, overrides: { fat: 0 } }).fat, 72);
});

test('ohne kcal gibt es keine Richtwerte', () => {
  assert.equal(nutrientTargets({ kcal: null }), null);
});

test('ringProgress begrenzt auf 0 bis 1 und kommt mit null/0 zurecht', () => {
  assert.equal(ringProgress(50, 100), 0.5);
  assert.equal(ringProgress(150, 100), 1);
  assert.equal(ringProgress(null, 100), 0);
  assert.equal(ringProgress(10, 0), 0);
});

test('NUTRIENTS: fünf Einträge mit deutschen Namen und Farben', () => {
  assert.deepEqual(NUTRIENTS.map((n) => n.label), ['Eiweiß', 'Kohlenhydrate', 'Fett', 'Ballaststoffe', 'Zucker']);
  assert.equal(NUTRIENTS[0].color, '#ff6b57');
});
