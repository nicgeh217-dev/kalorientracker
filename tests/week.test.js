import test from 'node:test';
import assert from 'node:assert/strict';
import { weekOf, shiftWeek } from '../src/week.js';

test('Woche enthält Sonntag und Montag derselben Woche', () => {
  const w = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  assert.deepEqual(weekOf('2026-10-25'), w);
  assert.deepEqual(weekOf('2026-10-19'), w);
});

test('Jahreswechsel und Schaltjahr', () => {
  const y = weekOf('2027-01-01');
  assert.equal(y[0], '2026-12-28');
  assert.equal(y[6], '2027-01-03');
  const s = weekOf('2028-02-29');
  assert.equal(s[0], '2028-02-28');
  assert.equal(s[6], '2028-03-05');
});

test('shiftWeek verschiebt um ganze Wochen, gleicher Wochentag', () => {
  assert.equal(shiftWeek('2026-10-25', -1), '2026-10-18');
  assert.equal(shiftWeek('2026-12-28', 1), '2027-01-04');
  assert.equal(shiftWeek('2026-10-25', 0), '2026-10-25');
});
