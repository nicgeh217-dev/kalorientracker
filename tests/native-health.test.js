import test from 'node:test';
import assert from 'node:assert/strict';
import { healthClient, READ_TYPES, WRITE_TYPES } from '../src/native-health.js';

function fakeCap(handlers = {}) {
  const calls = [];
  return {
    calls,
    cap: {
      isNativePlatform: () => true,
      nativePromise: async (plugin, method, options) => {
        assert.equal(plugin, 'Health');
        calls.push([method, options]);
        const h = handlers[method];
        if (typeof h === 'function') return h(options);
        if (h instanceof Error) throw h;
        return h ?? {};
      },
    },
  };
}

test('connect: fragt alle Lese- und Schreibrechte und den Verlauf über 30 Tage', async () => {
  const f = fakeCap({ requestAuthorization: { readAuthorized: ['steps'], writeAuthorized: ['dietaryEnergyConsumed'] } });
  const r = await healthClient({ cap: f.cap }).connect();
  const [, o] = f.calls[0];
  assert.deepEqual(o.read, READ_TYPES);
  assert.deepEqual(o.write, WRITE_TYPES);
  assert.equal(o.requestHistoryAccess, true);
  assert.deepEqual(r, { read: ['steps'], write: ['dietaryEnergyConsumed'] });
  for (const t of ['steps', 'calories', 'totalCalories', 'restingHeartRate', 'sleep', 'weight', 'workouts']) assert.ok(READ_TYPES.includes(t), t);
  assert.deepEqual(WRITE_TYPES, ['dietaryEnergyConsumed', 'dietaryProtein']);
});

test('available: nur wenn das Plugin Health Connect meldet', async () => {
  assert.equal(await healthClient({ cap: fakeCap({ isAvailable: { available: true } }).cap }).available(), true);
  assert.equal(await healthClient({ cap: fakeCap({ isAvailable: { available: false } }).cap }).available(), false);
  assert.equal(await healthClient({ cap: fakeCap({ isAvailable: new Error('x') }).cap }).available(), false);
});

test('readAll: Tagessummen, Schlaf, Gewicht und alle Seiten der Trainings', async () => {
  const range = { start: '2026-11-20T00:00:00.000Z', end: '2026-11-23T12:00:00.000Z' };
  let page = 0;
  const f = fakeCap({
    queryAggregated: (o) => ({ samples: [{ startDate: o.startDate, value: o.dataType === 'restingHeartRate' ? 57 : 100 }] }),
    readSamples: (o) => ({ samples: [{ dataType: o.dataType, startDate: o.startDate, endDate: o.endDate, value: 1 }] }),
    queryWorkouts: (o) => {
      page += 1;
      return page === 1 ? { workouts: [{ workoutType: 'running' }], anchor: 'next' } : { workouts: [{ workoutType: 'cycling' }] };
    },
  });
  const r = await healthClient({ cap: f.cap }).readAll(range);
  assert.equal(r.steps[0].value, 100);
  assert.equal(r.restingHr[0].value, 57);
  assert.equal(r.sleep.length, 1);
  assert.equal(r.weights.length, 1);
  assert.deepEqual(r.workouts.map((w) => w.workoutType), ['running', 'cycling']);
  const agg = f.calls.filter(([m]) => m === 'queryAggregated').map(([, o]) => [o.dataType, o.aggregation, o.bucket]);
  // Stundenwerte: Das Plugin zählt 'day' als 24 Stunden ab Start, nicht als Kalendertag.
  assert.deepEqual(agg, [['steps', 'sum', 'hour'], ['calories', 'sum', 'hour'], ['restingHeartRate', 'average', 'hour']]);
  // Gesamt-Kalorien lassen sich nicht aggregieren: Einzelwerte lesen.
  assert.equal(r.totalKcal.length, 1);
  const second = f.calls.filter(([m]) => m === 'queryWorkouts')[1][1];
  assert.equal(second.anchor, 'next');
});

test('readAll: ein Typ, der fehlschlägt, ist null (nicht gelesen), die anderen kommen trotzdem', async () => {
  const f = fakeCap({
    queryAggregated: (o) => { if (o.dataType === 'steps') throw new Error('kein Recht'); return { samples: [{ value: 5 }] }; },
    readSamples: { samples: [] },
    queryWorkouts: new Error('kein Recht'),
  });
  const r = await healthClient({ cap: f.cap }).readAll({ start: 'a', end: 'b' });
  assert.equal(r.steps, null);
  assert.equal(r.activeKcal.length, 1);
  assert.equal(r.workouts, null);
});

test('readAll: höchstens 10 Seiten Trainings', async () => {
  const f = fakeCap({ queryAggregated: { samples: [] }, readSamples: { samples: [] }, queryWorkouts: { workouts: [{}], anchor: 'immer' } });
  const r = await healthClient({ cap: f.cap }).readAll({ start: 'a', end: 'b' });
  assert.equal(r.workouts.length, 10);
});

test('writeDay: Kalorien und Protein über den ganzen Tag in Ortszeit', async () => {
  const f = fakeCap();
  await healthClient({ cap: f.cap }).writeDay({ dateKey: '2026-11-22', kcal: 1830, protein: 92 });
  const saves = f.calls.filter(([m]) => m === 'saveSample').map(([, o]) => o);
  assert.deepEqual(saves.map((s) => [s.dataType, s.value]), [['dietaryEnergyConsumed', 1830], ['dietaryProtein', 92]]);
  assert.equal(saves[0].startDate, new Date(2026, 10, 22, 0, 0, 0).toISOString());
  assert.equal(saves[0].endDate, new Date(2026, 10, 22, 23, 59, 59).toISOString());
});

test('writeDay: scheitert nur das Protein, gilt der Tag trotzdem als geschrieben (keine doppelten Kalorien)', async () => {
  const f = fakeCap({ saveSample: (o) => { if (o.dataType === 'dietaryProtein') throw new Error('kein Recht'); return {}; } });
  await healthClient({ cap: f.cap }).writeDay({ dateKey: '2026-11-22', kcal: 500, protein: 30 });
});

test('writeDay: scheitern die Kalorien, wird der Fehler weitergegeben', async () => {
  const f = fakeCap({ saveSample: new Error('kein Recht') });
  await assert.rejects(() => healthClient({ cap: f.cap }).writeDay({ dateKey: '2026-11-22', kcal: 500, protein: 30 }));
});

test('writeDay: Protein 0 wird nicht geschrieben', async () => {
  const f = fakeCap();
  await healthClient({ cap: f.cap }).writeDay({ dateKey: '2026-11-22', kcal: 500, protein: 0 });
  assert.equal(f.calls.filter(([m]) => m === 'saveSample').length, 1);
});

test('im Browser passiert nichts', async () => {
  let called = false;
  const cap = { isNativePlatform: () => false, nativePromise: async () => { called = true; } };
  const c = healthClient({ cap });
  assert.equal(await c.available(), false);
  await c.readAll({ start: 'a', end: 'b' });
  await c.writeDay({ dateKey: '2026-11-22', kcal: 1, protein: 1 });
  assert.equal(called, false);
});

test('readAll: Gesamt-Kalorien wochenweise als Einzelwerte, bei langem Zeitraum mehrere Abfragen', async () => {
  const f = fakeCap({ queryAggregated: { samples: [] }, readSamples: (o) => ({ samples: o.dataType === 'totalCalories' ? [{ startDate: o.startDate, value: 10 }] : [] }), queryWorkouts: { workouts: [] } });
  const r = await healthClient({ cap: f.cap }).readAll({ start: new Date(2026, 7, 25).toISOString(), end: new Date(2026, 10, 23, 15).toISOString() });
  const chunks = f.calls.filter(([m, o]) => m === 'readSamples' && o.dataType === 'totalCalories').map(([, o]) => o);
  assert.equal(chunks.length, 13);
  assert.equal(chunks[0].startDate, new Date(2026, 7, 25).toISOString());
  assert.equal(chunks.at(-1).endDate, new Date(2026, 10, 23, 15).toISOString());
  for (let i = 1; i < chunks.length; i += 1) assert.equal(chunks[i].startDate, chunks[i - 1].endDate);
  assert.equal(r.totalKcal.length, 13);
});
