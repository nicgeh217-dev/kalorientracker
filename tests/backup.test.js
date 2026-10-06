import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup } from '../src/backup.js';

const data = {
  products: [{ id: 1, name: 'Kimbap', basis: 'per100g', kcal: 200 }],
  meals: [{ id: 1, timestamp: '2026-10-06T12:00:00.000Z', dateKey: '2026-10-06', kcal: 300 }],
  weights: [{ date: '2026-10-06', kg: 72.5 }],
  settings: { calorieGoal: 2200, geminiKey: 'SECRET' },
};
const now = new Date('2026-10-06T12:00:00Z');

test('buildBackup entfernt geminiKey', () => {
  const b = buildBackup(data, now);
  assert.equal(b.version, 1);
  assert.equal(b.settings.calorieGoal, 2200);
  assert.ok(!('geminiKey' in b.settings));
  assert.equal(data.settings.geminiKey, 'SECRET');
});

test('Roundtrip ist ok', () => {
  const r = parseBackup(JSON.stringify(buildBackup(data, now)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.meals, data.meals);
});

test('kaputtes JSON -> Fehler', () => {
  assert.equal(parseBackup('{nope').ok, false);
});

test('fremde JSON-Datei -> Fehler', () => {
  assert.equal(parseBackup('{"hello":"world"}').ok, false);
  assert.equal(parseBackup('[1,2,3]').ok, false);
  assert.equal(parseBackup('null').ok, false);
});

test('falsche Version -> Fehler', () => {
  const b = { ...buildBackup(data, now), version: 2 };
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
});

test('meals kein Array -> Fehler', () => {
  const b = { ...buildBackup(data, now), meals: {} };
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
});

test('Mahlzeit ohne timestamp -> Fehler', () => {
  const b = buildBackup(data, now);
  b.meals = [{ id: 2, kcal: 5 }];
  const r = parseBackup(JSON.stringify(b));
  assert.equal(r.ok, false);
  assert.match(r.error, /Mahlzeit/);
});

test('Gewicht mit ungültigem kg -> Fehler', () => {
  const b = buildBackup(data, now);
  b.weights = [{ date: '2026-10-06', kg: 'viel' }];
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
});
