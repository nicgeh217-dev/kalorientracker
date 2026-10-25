import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreFromText } from '../src/backup-import.js';
import { buildBackup } from '../src/backup.js';

const data = {
  products: [{ id: 1, name: 'Kimbap' }],
  meals: [{ id: 1, timestamp: '2026-10-06T12:00:00.000Z', dateKey: '2026-10-06', kcal: 300 }, { id: 2, timestamp: '2026-10-07T12:00:00.000Z', dateKey: '2026-10-07', kcal: 200 }],
  weights: [{ date: '2026-10-06', kg: 72.5 }],
  settings: { calorieGoal: 2200 },
};
const goodText = JSON.stringify(buildBackup(data, new Date('2026-10-06T12:00:00Z')));

test('gültige Datei: replace wird einmal aufgerufen, Anzahlen kommen zurück', async () => {
  const calls = [];
  const r = await restoreFromText(goodText, async (d) => { calls.push(d); });
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { meals: 2, products: 1, weights: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].meals.length, 2);
});

test('kaputtes JSON: Fehler, replace wird nicht aufgerufen', async () => {
  let called = false;
  const r = await restoreFromText('{nope', async () => { called = true; });
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test('fremde Version: Fehler, replace wird nicht aufgerufen', async () => {
  let called = false;
  const r = await restoreFromText(JSON.stringify({ ...JSON.parse(goodText), version: 3 }), async () => { called = true; });
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test('replace schlägt fehl: Fehler mit verständlichem Text, bisherige Daten unverändert (kein Wurf)', async () => {
  const r = await restoreFromText(goodText, async () => { throw new Error('quota'); });
  assert.equal(r.ok, false);
  assert.match(r.error, /unverändert/);
});
