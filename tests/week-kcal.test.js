import test from 'node:test';
import assert from 'node:assert/strict';
import { lastDays, nightSeries } from '../src/week-kcal.js';

test('lastDays: sieben Tage bis zum gewählten Tag, älteste zuerst', () => {
  const meals = [
    { dateKey: '2026-11-24', kcal: 500 }, { dateKey: '2026-11-24', kcal: 612.4 },
    { dateKey: '2026-11-22', kcal: 800 }, { dateKey: '2026-11-10', kcal: 999 },
  ];
  const d = lastDays(meals, '2026-11-24');
  assert.equal(d.length, 7);
  assert.equal(d[0].dateKey, '2026-11-18');
  assert.equal(d[6].dateKey, '2026-11-24');
  assert.deepEqual([d[6].kcal, d[6].meals], [1112, 2]);
  assert.deepEqual([d[4].kcal, d[4].meals], [800, 1]);
  assert.deepEqual([d[0].kcal, d[0].meals], [0, 0]);
});

test('lastDays: Schnitt zählt nur Tage mit Einträgen, ohne Einträge null', () => {
  const d = lastDays([{ dateKey: '2026-11-24', kcal: 1000 }, { dateKey: '2026-11-23', kcal: 2000 }], '2026-11-24');
  assert.equal(d.avg, 1500);
  assert.equal(lastDays([], '2026-11-24').avg, null);
});

test('nightSeries: Schlafminuten der letzten sieben Nächte, fehlende als 0', () => {
  const s = nightSeries([{ dateKey: '2026-11-24', sleepMin: 372 }, { dateKey: '2026-11-20', sleepMin: 400 }], '2026-11-24');
  assert.equal(s.length, 7);
  assert.deepEqual([s[6], s[2], s[0]], [372, 400, 0]);
});
