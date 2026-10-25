import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, slotForTime, groupBySlot } from '../src/slots.js';

const at = (h) => new Date(2026, 9, 25, h).toISOString();

test('Uhrzeit -> Abschnitt', () => {
  const expected = { 4: 'snack', 5: 'breakfast', 10: 'breakfast', 11: 'lunch', 14: 'lunch', 15: 'snack', 16: 'snack', 17: 'dinner', 21: 'dinner', 22: 'snack' };
  for (const [h, slot] of Object.entries(expected)) assert.equal(slotForTime(at(Number(h))), slot, `Stunde ${h}`);
});

test('SLOTS in fester Reihenfolge mit deutschen Namen', () => {
  assert.deepEqual(SLOTS.map((s) => s.label), ['Frühstück', 'Mittagessen', 'Abendessen', 'Snacks']);
});

test('groupBySlot liefert immer vier Gruppen, auch ohne Mahlzeiten', () => {
  const g = groupBySlot([]);
  assert.deepEqual(g.map((x) => x.slot), ['breakfast', 'lunch', 'dinner', 'snack']);
  assert.ok(g.every((x) => x.meals.length === 0 && x.kcal === 0));
});

test('groupBySlot ordnet nach Uhrzeit, slot überstimmt, kcal wird summiert', () => {
  const meals = [
    { id: 1, timestamp: at(8), kcal: 200.4 },
    { id: 2, timestamp: at(8), kcal: 100.4 },
    { id: 3, timestamp: at(12), kcal: 500, slot: 'dinner' },
    { id: 4, timestamp: at(23), kcal: 50 },
  ];
  const g = Object.fromEntries(groupBySlot(meals).map((x) => [x.slot, x]));
  assert.deepEqual(g.breakfast.meals.map((m) => m.id), [1, 2]);
  assert.equal(g.breakfast.kcal, 301);
  assert.deepEqual(g.dinner.meals.map((m) => m.id), [3]);
  assert.equal(g.lunch.kcal, 0);
  assert.equal(g.snack.kcal, 50);
});

test('unbekannter slot-Wert fällt auf die Uhrzeit zurück statt die Mahlzeit zu verlieren', () => {
  const g = groupBySlot([{ id: 1, timestamp: at(8), kcal: 100, slot: 'brunch' }]);
  assert.equal(g.find((x) => x.slot === 'breakfast').meals.length, 1);
  assert.equal(g.reduce((s, x) => s + x.meals.length, 0), 1);
});
