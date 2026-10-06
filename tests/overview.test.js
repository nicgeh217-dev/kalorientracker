import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, weekSummary, rollingAverage, pickRecent } from '../src/overview.js';

test('addDays über Monats-, Jahres- und Schaltjahrgrenzen', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(addDays('2026-10-06', 0), '2026-10-06');
});

test('addDays bei Zeitumstellung bleibt exakt ein Kalendertag', () => {
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
});

const day = (dateKey, kcal, meals = kcal > 0 ? 1 : 0) => ({ dateKey, kcal, meals });

test('weekSummary: Schnitt nur über Tage mit Einträgen', () => {
  const s = weekSummary([day('a', 2000), day('b', 0), day('c', 2400), day('d', 0)], 2200);
  assert.equal(s.loggedDays, 2);
  assert.equal(s.avgKcal, 2200);
  assert.equal(s.daysInGoal, 1);
});

test('weekSummary: ohne Einträge -> avgKcal null', () => {
  const s = weekSummary([day('a', 0), day('b', 0)], 2200);
  assert.deepEqual(s, { avgKcal: null, loggedDays: 0, daysInGoal: 0 });
});

test('weekSummary: ohne Ziel zählt kein Tag als im Ziel', () => {
  const s = weekSummary([day('a', 1500), day('b', 1800)], null);
  assert.equal(s.daysInGoal, 0);
  assert.equal(s.avgKcal, 1650);
});

test('weekSummary: genau Ziel zählt als im Ziel', () => {
  assert.equal(weekSummary([day('a', 2200)], 2200).daysInGoal, 1);
});

test('rollingAverage: 7-Tage-Fenster, Lücken erlaubt', () => {
  const w = [
    { date: '2026-10-01', kg: 74 },
    { date: '2026-10-03', kg: 73 },
    { date: '2026-10-07', kg: 72 },
    { date: '2026-10-20', kg: 71 },
  ];
  const r = rollingAverage(w, 7);
  assert.deepEqual(r.map((x) => x.kg), [74, 73.5, 73, 71]);
  assert.deepEqual(r.map((x) => x.date), w.map((x) => x.date));
});

test('rollingAverage: Eintrag genau 7 Tage zuvor liegt außerhalb des Fensters', () => {
  const r = rollingAverage([{ date: '2026-10-01', kg: 80 }, { date: '2026-10-08', kg: 70 }], 7);
  assert.equal(r[1].kg, 70);
});

test('rollingAverage: leere Liste', () => {
  assert.deepEqual(rollingAverage([], 7), []);
});

const m = (id, ts, productId, name = 'x') => ({ id, timestamp: ts, productId, name });

test('pickRecent: neueste pro Produkt, absteigend, begrenzt', () => {
  const meals = [
    m(1, '2026-10-01T08:00:00Z', 1, 'Kaffee'),
    m(2, '2026-10-02T08:00:00Z', 2, 'Kimbap'),
    m(3, '2026-10-03T08:00:00Z', 1, 'Kaffee'),
    m(4, '2026-10-04T08:00:00Z', 3, 'Wrap'),
  ];
  const r = pickRecent(meals, 2);
  assert.deepEqual(r.map((x) => x.id), [4, 3]);
  assert.deepEqual(pickRecent(meals, 10).map((x) => x.id), [4, 3, 2]);
});

test('pickRecent: Mahlzeiten ohne Produkt werden über den Namen zusammengefasst', () => {
  const meals = [
    m(1, '2026-10-01T08:00:00Z', null, 'Banane'),
    m(2, '2026-10-02T08:00:00Z', null, 'Banane'),
    m(3, '2026-10-02T09:00:00Z', null, 'Apfel'),
  ];
  assert.deepEqual(pickRecent(meals, 5).map((x) => x.id), [3, 2]);
});

test('pickRecent verändert die Eingabe nicht', () => {
  const meals = [m(1, '2026-10-02T08:00:00Z', 1), m(2, '2026-10-01T08:00:00Z', 2)];
  const copy = JSON.stringify(meals);
  pickRecent(meals, 5);
  assert.equal(JSON.stringify(meals), copy);
});
