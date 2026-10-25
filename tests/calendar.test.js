import test from 'node:test';
import assert from 'node:assert/strict';
import { yearGrid, intensity } from '../src/calendar.js';

const TODAY = '2026-10-25'; // Sonntag
const cells = (g) => g.weeks.flat();

test('Intensität zählt nur Einträge, nicht Kalorien', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(intensity), [0, 1, 2, 2, 3, 3]);
});

test('53 Wochen zu je 7 Zellen, Montag zuerst, letzte Woche enthält heute', () => {
  const g = yearGrid({ counts: {}, statuses: {}, todayKey: TODAY });
  assert.equal(g.weeks.length, 53);
  assert.ok(g.weeks.every((w) => w.length === 7));
  const last = g.weeks.at(-1);
  assert.equal(last[0].dateKey, '2026-10-19');
  assert.equal(last[6].dateKey, TODAY);
  assert.equal(cells(g).filter((c) => c.isToday).length, 1);
  assert.equal(g.weeks[0][0].dateKey, '2025-10-20');
});

test('heute mitten in der Woche: Zellen danach sind Zukunft', () => {
  const g = yearGrid({ counts: {}, statuses: {}, todayKey: '2026-10-21' }); // Mittwoch
  const last = g.weeks.at(-1);
  assert.deepEqual(last.map((c) => c.isFuture), [false, false, false, true, true, true, true]);
  assert.equal(last[2].isToday, true);
});

test('Stufe nach Anzahl, Status wird übernommen, Zukunft zählt nicht in tracked', () => {
  const g = yearGrid({
    counts: { '2026-10-19': 1, '2026-10-20': 2, '2026-10-21': 5, '2026-10-26': 3 },
    statuses: { '2026-10-22': 'sick', '2026-10-23': 'rest' },
    todayKey: '2026-10-21',
  });
  const by = Object.fromEntries(cells(g).map((c) => [c.dateKey, c]));
  assert.deepEqual([by['2026-10-19'].level, by['2026-10-20'].level, by['2026-10-21'].level], [1, 2, 3]);
  assert.equal(by['2026-10-22'].status, 'sick');
  assert.equal(by['2026-10-23'].status, 'rest');
  assert.equal(by['2026-10-19'].status, null);
  assert.equal(g.tracked, 3);
});

test('Einträge außerhalb des Zeitraums werden nicht gezählt', () => {
  const g = yearGrid({ counts: { '2020-01-01': 4 }, statuses: {}, todayKey: TODAY });
  assert.equal(g.tracked, 0);
});
