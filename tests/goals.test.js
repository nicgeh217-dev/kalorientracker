import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntGoal } from '../src/goals.js';
import { forecast } from '../src/overview.js';

test('parseIntGoal: leer ist erlaubt (kein Ziel)', () => {
  assert.deepEqual(parseIntGoal(''), { ok: true, value: null });
  assert.deepEqual(parseIntGoal('   '), { ok: true, value: null });
  assert.deepEqual(parseIntGoal(null), { ok: true, value: null });
});

test('parseIntGoal: gültige ganze Zahlen', () => {
  assert.deepEqual(parseIntGoal('2200'), { ok: true, value: 2200 });
  assert.deepEqual(parseIntGoal(' 120 ', { max: 500 }), { ok: true, value: 120 });
});

test('parseIntGoal: Ungültiges wird abgelehnt', () => {
  for (const bad of ['abc', '0', '-5', '1.5', '1,5', '99999', '12kg']) {
    assert.equal(parseIntGoal(bad).ok, false, `"${bad}" sollte abgelehnt werden`);
  }
  assert.equal(parseIntGoal('600', { max: 500 }).ok, false);
});

const series = (startDate, startKg, perDay, n) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i)); // ab 1. Sept 2026
    return { date: d.toISOString().slice(0, 10), kg: Math.round((startKg + perDay * i) * 100) / 100 };
  });

test('forecast: Abnahme -> Datum und Wochenrate', () => {
  const w = series('2026-09-01', 80, -0.1, 11); // 80 -> 79 am 11.09.
  const f = forecast(w, 75);
  assert.equal(f.status, 'ok');
  assert.equal(f.date, '2026-10-21');
  assert.equal(f.perWeek, -0.7);
});

test('forecast: zu wenig Daten', () => {
  assert.equal(forecast(series('x', 80, -0.1, 2), 75).status, 'nodata');
  assert.equal(forecast(series('x', 80, -0.1, 5), 75).status, 'nodata'); // 5 Einträge, aber nur 4 Tage Spanne
  assert.equal(forecast([], 75).status, 'nodata');
});

test('forecast: Ziel schon erreicht (±0,3 kg), auch ohne Verlauf', () => {
  assert.equal(forecast([{ date: '2026-09-01', kg: 75.2 }], 75).status, 'reached');
});

test('forecast: flacher Verlauf', () => {
  assert.equal(forecast(series('x', 80, 0, 14), 75).status, 'flat');
});

test('forecast: falsche Richtung (Zunahme, Ziel darunter)', () => {
  const f = forecast(series('x', 80, 0.1, 14), 75);
  assert.equal(f.status, 'wrongway');
});

test('forecast: Zunahme zum höheren Zielgewicht funktioniert auch', () => {
  const f = forecast(series('x', 70, 0.1, 11), 75); // 70 -> 71 am 11.09.
  assert.equal(f.status, 'ok');
  assert.equal(f.date, '2026-10-21');
});

test('forecast: mehr als 2 Jahre -> far', () => {
  const f = forecast(series('x', 90, -0.01, 20), 50);
  assert.equal(f.status, 'far');
});

test('forecast: nur die letzten 28 Tage zählen', () => {
  const old = series('x', 100, 0, 20); // alte, konstante Phase (Sept)
  const recent = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 20 + i)); // ab 20. Okt, 15 Tage
    return { date: d.toISOString().slice(0, 10), kg: Math.round((90 - 0.2 * i) * 100) / 100 };
  });
  const f = forecast([...old, ...recent], 80);
  assert.equal(f.status, 'ok');
  assert.ok(f.perWeek < -1.2 && f.perWeek > -1.6, `perWeek ${f.perWeek}`);
});
