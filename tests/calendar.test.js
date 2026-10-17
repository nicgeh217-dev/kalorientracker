import test from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, shiftMonth, intensity } from '../src/calendar.js';

const flat = (weeks) => weeks.flat();

test('Intensität zählt nur Einträge, nicht Kalorien', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(intensity), [0, 1, 2, 2, 3, 3]);
});

test('Oktober 2026 beginnt am Donnerstag: 3 leere Felder, 31 Tage, 5 Wochen, Montag zuerst', () => {
  const g = monthGrid({ year: 2026, month: 10, counts: {}, weightDays: new Set(), todayKey: '2026-10-15' });
  assert.equal(g.weeks.length, 5);
  assert.ok(g.weeks.every((w) => w.length === 7));
  const cells = flat(g.weeks);
  assert.deepEqual(cells.slice(0, 3), [null, null, null]);
  assert.equal(cells[3].dateKey, '2026-10-01');
  assert.equal(cells.filter(Boolean).length, 31);
  assert.equal(cells.filter(Boolean).at(-1).dateKey, '2026-10-31');
});

test('März 2026 beginnt am Sonntag und hat 31 Tage: 6 Wochen', () => {
  const g = monthGrid({ year: 2026, month: 3, counts: {}, weightDays: new Set(), todayKey: '2026-10-15' });
  assert.equal(g.weeks.length, 6);
  assert.equal(flat(g.weeks).slice(0, 6).every((c) => c === null), true);
  assert.equal(flat(g.weeks)[6].dateKey, '2026-03-01');
});

test('Februar 2026 (Sonntag, 28 Tage): 5 Wochen', () => {
  const g = monthGrid({ year: 2026, month: 2, counts: {}, weightDays: new Set(), todayKey: '2026-10-15' });
  assert.equal(g.weeks.length, 5);
});

test('Zellen: Anzahl, Stufe, Gewicht, heute und Zukunft', () => {
  const g = monthGrid({
    year: 2026, month: 10,
    counts: { '2026-10-03': 1, '2026-10-05': 3, '2026-10-14': 5, '2026-10-20': 2 },
    weightDays: new Set(['2026-10-05']),
    todayKey: '2026-10-15',
  });
  const by = Object.fromEntries(flat(g.weeks).filter(Boolean).map((c) => [c.dateKey, c]));
  assert.equal(by['2026-10-03'].level, 1);
  assert.equal(by['2026-10-05'].level, 2);
  assert.equal(by['2026-10-05'].weight, true);
  assert.equal(by['2026-10-14'].level, 3);
  assert.equal(by['2026-10-04'].level, 0);
  assert.equal(by['2026-10-15'].isToday, true);
  assert.equal(by['2026-10-14'].isToday, false);
  assert.equal(by['2026-10-16'].isFuture, true);
  assert.equal(by['2026-10-15'].isFuture, false);
});

test('Zusammenfassung: nur vergangene Tage dieses Monats zählen, Zukunft nicht', () => {
  const g = monthGrid({
    year: 2026, month: 10,
    counts: { '2026-10-03': 1, '2026-10-05': 3, '2026-10-14': 5, '2026-10-15': 1, '2026-10-20': 2 },
    weightDays: new Set(), todayKey: '2026-10-15',
  });
  assert.equal(g.tracked, 4); // 3., 5., 14., 15. (der 20. liegt in der Zukunft)
  assert.equal(g.elapsed, 15);
});

test('Zusammenfassung eines vergangenen Monats: alle Tage zählen', () => {
  const g = monthGrid({ year: 2026, month: 9, counts: { '2026-09-10': 2 }, weightDays: new Set(), todayKey: '2026-10-15' });
  assert.equal(g.elapsed, 30);
  assert.equal(g.tracked, 1);
});

test('shiftMonth über Jahresgrenzen', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 5 }, 0), { year: 2026, month: 5 });
});
