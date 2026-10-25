import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MUSCLES, DEFAULT_EXERCISES, epley1RM, personalRecords, weeklySets, weeklySetSeries, muscleDistribution, strengthCurve,
  lastSetsFor, daysSinceMuscle, isNewRecord, workoutTitle, restRemaining, draftToWorkout,
} from '../src/training.js';

const EX = [
  { id: 1, name: 'Bankdrücken', muscle: 'Brust' },
  { id: 2, name: 'Schulterdrücken', muscle: 'Schultern' },
  { id: 3, name: 'Kniebeugen', muscle: 'Beine' },
  { id: 4, name: 'Fliegende', muscle: 'Brust' },
];
const W = (dateKey, sets, extra = {}) => ({ id: dateKey, dateKey, startedAt: 0, durationMin: 30, title: 'x', sets, ...extra });
const TODAY = '2026-10-25';

test('Stammdaten: Muskelgruppen und acht Standardübungen', () => {
  assert.deepEqual(MUSCLES, ['Brust', 'Rücken', 'Beine', 'Schultern', 'Arme', 'Core', 'Ganzkörper']);
  assert.equal(DEFAULT_EXERCISES.length, 8);
  assert.ok(DEFAULT_EXERCISES.every((e) => MUSCLES.includes(e.muscle)));
});

test('epley1RM: Formel, Körpergewicht (0 kg), ungültige Wiederholungen', () => {
  assert.equal(epley1RM(100, 5), 116.7);
  assert.equal(epley1RM(60, 1), 62);
  assert.equal(epley1RM(0, 10), 0);
  assert.equal(epley1RM(80, 0), null);
  assert.equal(epley1RM(80, null), null);
});

test('personalRecords: leer, bester Satz je Übung, absteigend sortiert', () => {
  assert.deepEqual(personalRecords([], EX), []);
  const r = personalRecords([
    W('2026-10-01', [{ exerciseId: 1, kg: 80, reps: 5 }, { exerciseId: 3, kg: 100, reps: 5 }]),
    W('2026-10-08', [{ exerciseId: 1, kg: 85, reps: 5 }, { exerciseId: 1, kg: 60, reps: 12 }]),
  ], EX);
  assert.equal(r.length, 2);
  assert.equal(r[0].exerciseId, 3);
  const bench = r.find((x) => x.exerciseId === 1);
  assert.deepEqual([bench.bestKg, bench.bestReps, bench.best1RM, bench.name], [85, 5, 99.2, 'Bankdrücken']);
});

test('weeklySets: nur die letzten 7 Tage, nach Muskel gruppiert', () => {
  const ws = [
    W('2026-10-25', [{ exerciseId: 1, kg: 50, reps: 8 }, { exerciseId: 1, kg: 50, reps: 8 }]),
    W('2026-10-19', [{ exerciseId: 3, kg: 80, reps: 5 }]),
    W('2026-10-17', [{ exerciseId: 2, kg: 30, reps: 8 }]), // 8 Tage her
  ];
  const r = weeklySets(ws, EX, TODAY);
  assert.equal(r.total, 3);
  assert.deepEqual(r.byMuscle, { Brust: 2, Beine: 1 });
  assert.deepEqual(weeklySets([], EX, TODAY), { total: 0, byMuscle: {} });
});

test('weeklySetSeries: acht Wochen, Montag-basiert, aufsteigend', () => {
  const s = weeklySetSeries([W('2026-10-25', [{ exerciseId: 1, kg: 1, reps: 1 }]), W('2026-10-12', [{ exerciseId: 1, kg: 1, reps: 1 }, { exerciseId: 1, kg: 1, reps: 1 }])], TODAY);
  assert.equal(s.length, 8);
  assert.equal(s.at(-1).weekStart, '2026-10-19');
  assert.equal(s.at(-1).sets, 1);
  assert.equal(s.at(-2).weekStart, '2026-10-12');
  assert.equal(s.at(-2).sets, 2);
  assert.equal(weeklySetSeries([], TODAY, 3).length, 3);
});

test('muscleDistribution: leer, Summe 100, absteigend', () => {
  assert.deepEqual(muscleDistribution([], EX, TODAY), []);
  const ws = [W('2026-10-20', [{ exerciseId: 1, kg: 1, reps: 1 }, { exerciseId: 1, kg: 1, reps: 1 }, { exerciseId: 3, kg: 1, reps: 1 }])];
  const d = muscleDistribution(ws, EX, TODAY);
  assert.equal(d[0].muscle, 'Brust');
  assert.equal(d.reduce((s, x) => s + x.percent, 0), 100);
  const odd = muscleDistribution([W('2026-10-20', [1, 2, 3].map((id) => ({ exerciseId: id, kg: 1, reps: 1 })))], EX, TODAY);
  assert.equal(odd.reduce((s, x) => s + x.percent, 0), 100);
  assert.deepEqual(muscleDistribution([W('2026-08-01', [{ exerciseId: 1, kg: 1, reps: 1 }])], EX, TODAY), []);
});

test('strengthCurve: nach Datum sortiert, bester Satz je Tag', () => {
  const c = strengthCurve([
    W('2026-10-10', [{ exerciseId: 1, kg: 90, reps: 3 }]),
    W('2026-10-01', [{ exerciseId: 1, kg: 60, reps: 10 }, { exerciseId: 1, kg: 80, reps: 5 }]),
  ], 1);
  assert.deepEqual(c.map((p) => p.dateKey), ['2026-10-01', '2026-10-10']);
  assert.equal(c[0].best1RM, 93.3);
  assert.deepEqual(strengthCurve([], 1), []);
});

test('lastSetsFor: Sätze der jüngsten Einheit, sonst leer', () => {
  const ws = [
    W('2026-10-01', [{ exerciseId: 1, kg: 60, reps: 10 }]),
    W('2026-10-08', [{ exerciseId: 1, kg: 70, reps: 8 }, { exerciseId: 2, kg: 20, reps: 8 }, { exerciseId: 1, kg: 72, reps: 6 }]),
  ];
  assert.deepEqual(lastSetsFor(ws, 1), [{ kg: 70, reps: 8 }, { kg: 72, reps: 6 }]);
  assert.deepEqual(lastSetsFor(ws, 3), []);
  assert.deepEqual(lastSetsFor([], 1), []);
});

test('isNewRecord: erster Satz nie, schwerer ja, leichter nein', () => {
  assert.equal(isNewRecord([], 1, { kg: 100, reps: 5 }), false);
  const ws = [W('2026-10-01', [{ exerciseId: 1, kg: 80, reps: 5 }])];
  assert.equal(isNewRecord(ws, 1, { kg: 85, reps: 5 }), true);
  assert.equal(isNewRecord(ws, 1, { kg: 70, reps: 5 }), false);
  assert.equal(isNewRecord(ws, 1, { kg: 80, reps: 5 }), false);
  assert.equal(isNewRecord(ws, 3, { kg: 50, reps: 5 }), false);
  assert.equal(isNewRecord(ws, 1, { kg: 90, reps: 0 }), false);
});

test('daysSinceMuscle: ohne Einheit null, sonst Tage seit der letzten', () => {
  assert.equal(daysSinceMuscle([], EX, 'Brust', TODAY), null);
  const ws = [W('2026-10-20', [{ exerciseId: 1, kg: 1, reps: 1 }]), W('2026-10-22', [{ exerciseId: 3, kg: 1, reps: 1 }])];
  assert.equal(daysSinceMuscle(ws, EX, 'Brust', TODAY), 5);
  assert.equal(daysSinceMuscle(ws, EX, 'Beine', TODAY), 3);
  assert.equal(daysSinceMuscle(ws, EX, 'Core', TODAY), null);
});

test('workoutTitle: zwei häufigste Muskelgruppen, leer ergibt Training', () => {
  assert.equal(workoutTitle([{ exerciseId: 1 }, { exerciseId: 4 }, { exerciseId: 2 }], EX), 'Brust + Schultern');
  assert.equal(workoutTitle([{ exerciseId: 3 }], EX), 'Beine');
  assert.equal(workoutTitle([], EX), 'Training');
  assert.equal(workoutTitle([{ exerciseId: 99 }], EX), 'Training');
});

test('restRemaining ist nie negativ', () => {
  assert.equal(restRemaining(0, 90000, 90), 0);
  assert.equal(restRemaining(0, 120000, 90), 0);
  assert.equal(restRemaining(0, 30000, 90), 60);
});

test('draftToWorkout: verwirft nicht abgehakte und leere Sätze, mindestens 1 Minute', () => {
  const draft = {
    dateKey: TODAY, startedAt: 1000,
    entries: [
      { exerciseId: 1, sets: [{ kg: 60, reps: 8, done: true }, { kg: 60, reps: 8, done: false }, { kg: 0, reps: 12, done: true }, { kg: 50, reps: 0, done: true }, { kg: null, reps: null, done: true }] },
      { exerciseId: 3, sets: [{ kg: 80, reps: 5, done: false }] },
    ],
  };
  const w = draftToWorkout(draft, 1000 + 10000, EX);
  assert.deepEqual(w.sets, [{ exerciseId: 1, kg: 60, reps: 8 }, { exerciseId: 1, kg: 0, reps: 12 }]);
  assert.equal(w.durationMin, 1);
  assert.equal(w.dateKey, TODAY);
  assert.equal(w.title, 'Brust');
  assert.equal(draftToWorkout(draft, 1000 + 25 * 60000, EX).durationMin, 25);
  const empty = draftToWorkout({ dateKey: TODAY, startedAt: 0, entries: [] }, 5000, EX);
  assert.deepEqual(empty.sets, []);
  assert.equal(empty.title, 'Training');
});

test('Dauer: Nachtragen hat keine Dauer, Fortsetzen am nächsten Tag wird gedeckelt, letzte Aktivität zählt', () => {
  const base = { dateKey: TODAY, startedAt: 0, entries: [{ exerciseId: 1, sets: [{ kg: 50, reps: 5, done: true }] }] };
  assert.equal(draftToWorkout({ ...base, manual: true }, 99 * 60000, EX).durationMin, null);
  assert.equal(draftToWorkout(base, 1440 * 60000, EX).durationMin, 240);
  assert.equal(draftToWorkout({ ...base, lastActivityAt: 40 * 60000 }, 500 * 60000, EX).durationMin, 40);
});

test('Körpergewichts-Übungen (0 kg) erzeugen keine Rekorde und keine Kurve mit Nullen', () => {
  const ws = [W('2026-10-01', [{ exerciseId: 1, kg: 0, reps: 60 }])];
  assert.deepEqual(personalRecords(ws, EX), []);
  assert.deepEqual(strengthCurve(ws, 1), []);
});
