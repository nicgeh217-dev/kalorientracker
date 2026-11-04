import test from 'node:test';
import assert from 'node:assert/strict';
import { weekReview, weekTitle } from '../src/week.js';

const base = { meals: [], workouts: [], weights: [] };

test('weekReview: zählt nur Tage der Woche des gewählten Tags (Mo bis So)', () => {
  const r = weekReview({
    ...base,
    dateKey: '2026-11-04',
    meals: [{ dateKey: '2026-11-01' }, { dateKey: '2026-11-02' }, { dateKey: '2026-11-02' }, { dateKey: '2026-11-08' }, { dateKey: '2026-11-09' }],
  });
  assert.deepEqual(r.days[0], '2026-11-02');
  assert.deepEqual(r.days[6], '2026-11-08');
  assert.equal(r.loggedDays, 2);
});

test('weekReview: mehrere Einheiten am Tag sind ein Trainingstag, Sätze werden addiert, leere Einheiten zählen nicht', () => {
  const s = (n) => Array.from({ length: n }, () => ({ exerciseId: 1, kg: 10, reps: 5 }));
  const r = weekReview({
    ...base,
    dateKey: '2026-11-04',
    workouts: [
      { dateKey: '2026-11-03', sets: s(4) }, { dateKey: '2026-11-03', sets: s(2) }, { dateKey: '2026-11-05', sets: s(3) },
      { dateKey: '2026-11-06', sets: [] }, { dateKey: '2026-11-10', sets: s(9) },
    ],
  });
  assert.equal(r.trainingDays, 2);
  assert.equal(r.sets, 9);
});

test('weekReview: Gewichte der Woche nach Datum, unabhängig von der Eingabereihenfolge', () => {
  const r = weekReview({
    ...base,
    dateKey: '2026-11-04',
    weights: [{ date: '2026-11-06', kg: 72.1 }, { date: '2026-10-30', kg: 80 }, { date: '2026-11-02', kg: 72.4 }],
  });
  assert.deepEqual(r.weights.map((w) => w.kg), [72.4, 72.1]);
});

test('weekReview: eine leere Woche ergibt Nullen und keine Gewichte', () => {
  const r = weekReview({ ...base, dateKey: '2026-11-04' });
  assert.deepEqual([r.loggedDays, r.trainingDays, r.sets, r.weights], [0, 0, 0, []]);
});

test('weekReview: enthält nichts, das nach Soll oder Bewertung aussieht', () => {
  const r = weekReview({ ...base, dateKey: '2026-11-04', weights: [{ date: '2026-11-02', kg: 70 }, { date: '2026-11-06', kg: 75 }] });
  assert.deepEqual(Object.keys(r).sort(), ['days', 'loggedDays', 'sets', 'trainingDays', 'weights']);
});

test('weekTitle: innerhalb eines Monats und über den Monatswechsel', () => {
  assert.equal(weekTitle('2026-11-04'), 'Woche vom 2. bis 8. November');
  assert.equal(weekTitle('2026-10-28'), 'Woche vom 26. Oktober bis 1. November');
});

test('weekTitle: über den Jahreswechsel', () => {
  assert.equal(weekTitle('2026-12-30'), 'Woche vom 28. Dezember bis 3. Januar');
});
