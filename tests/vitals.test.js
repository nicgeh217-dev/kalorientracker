import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKeyOf, sumByDay, valueByDay, averageByDay, sleepByDay, mergeVitalsDays, toFitbitWorkout, buildVitalsDays, visibleFitbitWorkouts,
  fitbitTrainingDays, weightsToImport, dayToWrite, syncWindow, shouldSync, formatSleep, avgSteps,
} from '../src/vitals.js';

// Ortszeit wie auf dem Handy: Tage werden nach lokaler Uhrzeit zugeordnet.
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const NOW = new Date(2026, 10, 23, 15, 0).getTime();

test('dayKeyOf: lokaler Kalendertag', () => {
  assert.equal(dayKeyOf(at(2026, 11, 22, 23, 50)), '2026-11-22');
  assert.equal(dayKeyOf(at(2026, 11, 23, 0, 10)), '2026-11-23');
});

test('sumByDay und valueByDay', () => {
  const s = [{ startDate: at(2026, 11, 22, 8), value: 4000 }, { startDate: at(2026, 11, 22, 18), value: 1200 }, { startDate: at(2026, 11, 23, 9), value: 300 }];
  assert.deepEqual(sumByDay(s), { '2026-11-22': 5200, '2026-11-23': 300 });
  assert.deepEqual(valueByDay([{ startDate: at(2026, 11, 22, 1), value: 58 }, { startDate: at(2026, 11, 22, 3), value: 56.6 }]), { '2026-11-22': 57 });
});

test('sleepByDay: Nacht über Mitternacht zählt zum End-Tag, Wachphasen zählen nicht, Nickerchen werden addiert', () => {
  const night = {
    startDate: at(2026, 11, 22, 23, 30), endDate: at(2026, 11, 23, 7, 0), value: 450, sleepState: 'asleep',
    stages: [
      { stage: 'light', durationMinutes: 200 }, { stage: 'deep', durationMinutes: 90 },
      { stage: 'rem', durationMinutes: 100 }, { stage: 'awake', durationMinutes: 40 }, { stage: 'inBed', durationMinutes: 20 },
    ],
  };
  const nap = { startDate: at(2026, 11, 23, 14, 0), endDate: at(2026, 11, 23, 14, 30), value: 30, sleepState: 'asleep' };
  const awakeOnly = { startDate: at(2026, 11, 23, 15, 0), endDate: at(2026, 11, 23, 15, 10), value: 10, sleepState: 'awake' };
  const r = sleepByDay([night, nap, awakeOnly]);
  assert.equal(r['2026-11-23'].sleepMin, 390 + 30);
  assert.equal(r['2026-11-23'].sleepStart, night.startDate);
  assert.equal(r['2026-11-23'].sleepEnd, awakeOnly.endDate);
  assert.equal(r['2026-11-22'], undefined);
});

test('toFitbitWorkout: deutscher Titel, Minuten, Kalorien', () => {
  const w = toFitbitWorkout({ workoutType: 'running', duration: 1925, totalEnergyBurned: 281.6, startDate: at(2026, 11, 22, 7), endDate: at(2026, 11, 22, 7, 32) });
  assert.deepEqual(w, { type: 'running', title: 'Laufen', start: at(2026, 11, 22, 7), end: at(2026, 11, 22, 7, 32), durationMin: 32, kcal: 282 });
  assert.equal(toFitbitWorkout({ workoutType: 'curling', duration: 60, startDate: at(2026, 11, 22), endDate: at(2026, 11, 22) }).title, 'Training');
  assert.equal(toFitbitWorkout({ workoutType: 'walking', duration: 60, startDate: at(2026, 11, 22), endDate: at(2026, 11, 22) }).kcal, null);
});

test('buildVitalsDays: nur vorhandene Felder, ein Datensatz je Tag', () => {
  const days = buildVitalsDays({
    steps: [{ startDate: at(2026, 11, 22), value: 8412 }],
    activeKcal: [], totalKcal: [{ startDate: at(2026, 11, 23), value: 2310.4 }],
    restingHr: [], sleep: [], workouts: [],
  }, NOW);
  assert.deepEqual(days, [
    { dateKey: '2026-11-22', steps: 8412, syncedAt: NOW },
    { dateKey: '2026-11-23', totalKcal: 2310, syncedAt: NOW },
  ]);
});

const fit = (type, h, min, durationMin = 30) => ({ type, title: type, start: at(2026, 11, 22, h, min), end: new Date(new Date(at(2026, 11, 22, h, min)).getTime() + durationMin * 60000).toISOString(), durationMin, kcal: 100 });

test('visibleFitbitWorkouts: überschneidet sich mit einer App-Einheit, wird ausgeblendet', () => {
  const app = [{ dateKey: '2026-11-22', startedAt: new Date(2026, 10, 22, 18, 0).getTime(), durationMin: 60, sets: [{}] }];
  const list = [fit('strengthTraining', 18, 20), fit('running', 7, 0)];
  assert.deepEqual(visibleFitbitWorkouts(list, app).map((w) => w.type), ['running']);
});

test('visibleFitbitWorkouts: nachgetragene Einheit ohne Dauer überschneidet nie', () => {
  const app = [{ dateKey: '2026-11-22', startedAt: new Date(2026, 10, 22, 18, 0).getTime(), durationMin: null, sets: [{}] }];
  assert.equal(visibleFitbitWorkouts([fit('running', 18, 10)], app).length, 1);
});

test('fitbitTrainingDays: Gehen zählt nicht, überschneidende Trainings auch nicht', () => {
  const vitals = [
    { dateKey: '2026-11-21', workouts: [fit('walking', 9, 0)] },
    { dateKey: '2026-11-22', workouts: [fit('running', 7, 0)] },
    { dateKey: '2026-11-23', workouts: [{ ...fit('cycling', 18, 0), start: at(2026, 11, 23, 18), end: at(2026, 11, 23, 18, 30) }] },
  ];
  const app = [{ dateKey: '2026-11-23', startedAt: new Date(2026, 10, 23, 18, 10).getTime(), durationMin: 40, sets: [{}] }];
  assert.deepEqual(fitbitTrainingDays(vitals, app), ['2026-11-22']);
});

test('weightsToImport: frühestes am Tag, App-Gewicht gewinnt, Korrektur eines übernommenen wird übernommen', () => {
  const samples = [
    { startDate: at(2026, 11, 20, 7), value: 74.04 }, { startDate: at(2026, 11, 20, 20), value: 75 },
    { startDate: at(2026, 11, 21, 7), value: 73.8 },
    { startDate: at(2026, 11, 22, 7), value: 73.5 },
    { startDate: at(2026, 11, 23, 7), value: 73.2 },
  ];
  const app = [
    { date: '2026-11-21', kg: 74.5 },
    { date: '2026-11-22', kg: 73.4, source: 'health' },
    { date: '2026-11-23', kg: 73.2, source: 'health' },
  ];
  assert.deepEqual(weightsToImport(samples, app), [
    { date: '2026-11-20', kg: 74, source: 'health' },
    { date: '2026-11-22', kg: 73.5, source: 'health' },
  ]);
});

test('dayToWrite: nur der Vortag, einmal, nicht leer und nicht krank', () => {
  const meals = [{ dateKey: '2026-11-22', kcal: 640.4, protein: 24.2 }, { dateKey: '2026-11-22', kcal: 320, protein: null }];
  assert.deepEqual(dayToWrite({ todayKey: '2026-11-23', meals, status: null, written: [] }), { dateKey: '2026-11-22', kcal: 960, protein: 24 });
  assert.equal(dayToWrite({ todayKey: '2026-11-23', meals, status: null, written: ['2026-11-22'] }), null);
  assert.equal(dayToWrite({ todayKey: '2026-11-23', meals: [], status: null, written: [] }), null);
  assert.equal(dayToWrite({ todayKey: '2026-11-23', meals, status: 'sick', written: [] }), null);
  assert.equal(dayToWrite({ todayKey: '2026-11-23', meals, status: 'rest', written: [] }).kcal, 960);
  assert.equal(dayToWrite({ todayKey: '2026-11-23', meals: [{ dateKey: '2026-11-23', kcal: 500 }], status: null, written: [] }), null);
});

test('syncWindow: erst 90 Tage ab Tagesbeginn, danach die letzten 3 Tage ab Tagesbeginn', () => {
  const first = syncWindow({ lastSyncAt: null, now: NOW });
  assert.equal(first.end, new Date(NOW).toISOString());
  assert.equal(first.start, new Date(2026, 7, 25, 0, 0).toISOString(), 'Mitternacht vor 90 Tagen, sonst landen Stunden auf dem falschen Tag');
  const later = syncWindow({ lastSyncAt: NOW - 3600000, now: NOW });
  assert.equal(later.start, new Date(2026, 10, 20, 0, 0).toISOString());
});

test('shouldSync: höchstens alle 5 Minuten', () => {
  assert.equal(shouldSync(null, NOW), true);
  assert.equal(shouldSync(NOW - 4 * 60000, NOW), false);
  assert.equal(shouldSync(NOW - 5 * 60000, NOW), true);
});

test('formatSleep und avgSteps', () => {
  assert.equal(formatSleep(432), '7 h 12 min');
  assert.equal(formatSleep(45), '45 min');
  assert.equal(formatSleep(480), '8 h');
  const v = [{ dateKey: '2026-11-17', steps: 8000 }, { dateKey: '2026-11-18', steps: 9000 }, { dateKey: '2026-11-19' }];
  assert.equal(avgSteps(v, ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']), 8500);
  assert.equal(avgSteps(v, ['2026-11-30']), null);
});

test('sumByDay: Stundenwerte werden zum Kalendertag zusammengezählt', () => {
  const hours = Array.from({ length: 30 }, (_, i) => ({ startDate: new Date(2026, 10, 22, 0 + i).toISOString(), value: 100 }));
  assert.deepEqual(sumByDay(hours), { '2026-11-22': 2400, '2026-11-23': 600 });
});

test('averageByDay: Ruhepuls als Tagesmittel der Stundenwerte', () => {
  assert.deepEqual(averageByDay([{ startDate: at(2026, 11, 22, 2), value: 55 }, { startDate: at(2026, 11, 22, 3), value: 58 }, { startDate: at(2026, 11, 23, 2), value: 60 }]), { '2026-11-22': 57, '2026-11-23': 60 });
});

test('sleepByDay: Phasen nach Start und Ende gerechnet, nicht abgerundet', () => {
  const s = (h, m, min, stage) => ({ startDate: new Date(2026, 10, 23, h, m).toISOString(), endDate: new Date(new Date(2026, 10, 23, h, m).getTime() + min * 60000).toISOString(), stage, durationMinutes: Math.floor(min) });
  const night = { startDate: at(2026, 11, 23, 1), endDate: at(2026, 11, 23, 2), value: 59, sleepState: 'asleep', stages: [s(1, 0, 20.5, 'light'), s(1, 20, 20.5, 'deep'), s(1, 41, 19, 'awake')] };
  assert.equal(sleepByDay([night])['2026-11-23'].sleepMin, 41);
});

test('buildVitalsDays: nicht gelesene Werte (null) erzeugen nichts', () => {
  assert.deepEqual(buildVitalsDays({ steps: null, activeKcal: null, totalKcal: null, restingHr: null, sleep: null, workouts: null }, NOW), []);
});

test('mergeVitalsDays: gelesene Werte ersetzen, fehlgeschlagene bleiben, Tage außerhalb bleiben unberührt', () => {
  const existing = [
    { dateKey: '2026-11-21', steps: 5000, sleepMin: 400, syncedAt: 1 },
    { dateKey: '2026-11-22', steps: 7000, sleepMin: 420, sleepStart: 'a', sleepEnd: 'b', workouts: [{ type: 'running' }], syncedAt: 1 },
    { dateKey: '2026-11-15', steps: 1, syncedAt: 1 },
  ];
  const fresh = [{ dateKey: '2026-11-22', steps: 8000, syncedAt: 2 }, { dateKey: '2026-11-23', steps: 900, syncedAt: 2 }];
  const out = mergeVitalsDays(existing, fresh, { read: ['steps', 'workouts'], from: '2026-11-20', to: '2026-11-23', now: 2 });
  assert.deepEqual(out, [
    { dateKey: '2026-11-21', sleepMin: 400, syncedAt: 2 },
    { dateKey: '2026-11-22', steps: 8000, sleepMin: 420, sleepStart: 'a', sleepEnd: 'b', syncedAt: 2 },
    { dateKey: '2026-11-23', steps: 900, syncedAt: 2 },
  ]);
});

test('toFitbitWorkout: weitere Trainingsarten haben deutsche Namen', () => {
  for (const [type, title] of [['weightlifting', 'Krafttraining'], ['runningTreadmill', 'Laufband'], ['bikingStationary', 'Ergometer'], ['other', 'Training']]) {
    assert.equal(toFitbitWorkout({ workoutType: type, duration: 60, startDate: at(2026, 11, 22), endDate: at(2026, 11, 22) }).title, title);
  }
});

test('buildVitalsDays: Puls je Tag aus Stundenwerten (Min, Max exakt, Ø gerundet)', () => {
  const h = (hour, average, min, max) => ({ startDate: new Date(2026, 10, 22, hour).toISOString(), values: { average, min, max } });
  const [d] = buildVitalsDays({ hr: [h(8, 70, 60, 90), h(9, 75, 55, 148), h(10, 72, 64, 80)] }, NOW);
  assert.deepEqual([d.hrAvg, d.hrMin, d.hrMax], [72, 55, 148]);
});

test('buildVitalsDays: Strecke in Metern, Stockwerke summiert, HRV/Sauerstoff/Atemfrequenz als Tagesmittel, VO2max und Körperfett als letzter Wert', () => {
  const s = (hour, value, day = 22) => ({ startDate: new Date(2026, 10, day, hour).toISOString(), value });
  const [d] = buildVitalsDays({
    distance: [s(8, 1200.4), s(17, 2000)], floors: [s(9, 3), s(18, 4)],
    hrv: [s(2, 40), s(4, 45)], spo2: [s(2, 95), s(3, 97.4)], respRate: [s(2, 14), s(3, 15)],
    vo2max: [s(7, 43), s(20, 44.2)], bodyFat: [s(7, 18.44), s(21, 18.2)],
  }, NOW);
  assert.equal(d.distanceM, 3200);
  assert.equal(d.floors, 7);
  assert.deepEqual([d.hrv, d.spo2, d.respRate], [43, 96, 15]);
  assert.equal(d.vo2max, 44);
  assert.equal(d.bodyFat, 18.2);
});

test('sleepByDay: Phasen in Minuten, nur wenn es Phasen gibt', () => {
  const t = (h, m) => new Date(2026, 10, 23, h, m).toISOString();
  const st = (a, b, stage) => ({ startDate: a, endDate: b, stage, durationMinutes: 0 });
  const withStages = { startDate: t(0, 0), endDate: t(3, 0), value: 170, sleepState: 'asleep', stages: [st(t(0, 0), t(1, 20), 'deep'), st(t(1, 20), t(2, 0), 'rem'), st(t(2, 0), t(2, 50), 'light'), st(t(2, 50), t(3, 0), 'awake')] };
  const d = sleepByDay([withStages])['2026-11-23'];
  assert.deepEqual([d.sleepDeep, d.sleepRem, d.sleepLight, d.sleepAwake], [80, 40, 50, 10]);
  const plain = sleepByDay([{ startDate: t(0, 0), endDate: t(6, 0), value: 360, sleepState: 'asleep' }])['2026-11-23'];
  assert.equal('sleepDeep' in plain, false);
});

test('mergeVitalsDays: nur die Felder des gelesenen Typs werden ersetzt', () => {
  const existing = [{ dateKey: '2026-11-22', hrAvg: 70, hrMin: 50, hrMax: 140, steps: 5000, syncedAt: 1 }];
  const out = mergeVitalsDays(existing, [], { read: ['hr'], from: '2026-11-20', to: '2026-11-23', now: 2 });
  assert.deepEqual(out, [{ dateKey: '2026-11-22', steps: 5000, syncedAt: 2 }]);
});
