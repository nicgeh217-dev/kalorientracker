import test from 'node:test';
import assert from 'node:assert/strict';
import { syncHealth } from '../src/health-sync.js';

const NOW = new Date(2026, 10, 23, 15, 0).getTime();
const iso = (d, h = 8) => new Date(2026, 10, d, h).toISOString();

function fakeStore({ health, meals = [], days = [], weights = [] } = {}) {
  const state = { settings: { calorieGoal: 2000, ...(health ? { health } : {}) }, vitals: [], weights: [...weights], meals, days };
  return {
    state,
    getSettings: async () => structuredClone(state.settings),
    saveSettings: async (s) => { state.settings = structuredClone(s); },
    listWeights: async () => state.weights,
    putWeights: async (list) => { for (const w of list) { state.weights = state.weights.filter((x) => x.date !== w.date).concat(w); } },
    putVitalsDays: async (list) => { state.vitals.push(...list); },
    listMeals: async () => state.meals,
    listDayStatuses: async () => state.days,
  };
}

function fakeClient({ fail = false } = {}) {
  const calls = { readAll: [], writeDay: [] };
  return {
    calls,
    readAll: async (range) => {
      calls.readAll.push(range);
      if (fail) throw new Error('Health Connect fehlt');
      return {
        steps: [{ startDate: iso(22), value: 8000 }], activeKcal: [], totalKcal: [], restingHr: [], sleep: [],
        weights: [{ startDate: iso(22, 7), value: 74.2 }], workouts: [],
      };
    },
    writeDay: async (d) => { calls.writeDay.push(d); },
  };
}

const connected = (extra = {}) => ({ connected: true, sendNutrition: true, written: [], ...extra });
const yesterdayMeals = [{ dateKey: '2026-11-22', kcal: 1800, protein: 90 }];

test('nicht verbunden: nichts passiert', async () => {
  const c = fakeClient();
  assert.equal(await syncHealth({ client: c, store: fakeStore(), now: NOW }), 'skipped');
  assert.equal(c.calls.readAll.length, 0);
});

test('höchstens alle 5 Minuten, außer erzwungen', async () => {
  const store = fakeStore({ health: connected({ lastAttemptAt: NOW - 60000 }) });
  assert.equal(await syncHealth({ client: fakeClient(), store, now: NOW }), 'skipped');
  assert.equal(await syncHealth({ client: fakeClient(), store, now: NOW, force: true }), 'done');
});

test('Erstabgleich: 90 Tage, speichert Tage, übernimmt Gewicht, schreibt den Vortag', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected(), meals: yesterdayMeals });
  assert.equal(await syncHealth({ client: c, store, now: NOW }), 'done');
  assert.equal(Math.round((NOW - new Date(c.calls.readAll[0].start).getTime()) / 86400000), 90);
  assert.deepEqual(store.state.vitals.map((v) => [v.dateKey, v.steps]), [['2026-11-22', 8000]]);
  assert.deepEqual(store.state.weights, [{ date: '2026-11-22', kg: 74.2, source: 'health' }]);
  assert.deepEqual(c.calls.writeDay, [{ dateKey: '2026-11-22', kcal: 1800, protein: 90 }]);
  const h = store.state.settings.health;
  assert.equal(h.lastSyncAt, NOW);
  assert.deepEqual(h.written, ['2026-11-22']);
  assert.equal(store.state.settings.calorieGoal, 2000, 'andere Einstellungen bleiben');
});

test('danach nur noch die letzten Tage, und ein Tag wird nie zweimal geschrieben', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected({ lastSyncAt: NOW - 3600000, lastAttemptAt: NOW - 3600000, written: ['2026-11-22'] }), meals: yesterdayMeals });
  await syncHealth({ client: c, store, now: NOW });
  assert.equal(c.calls.readAll[0].start, new Date(2026, 10, 20).toISOString());
  assert.equal(c.calls.writeDay.length, 0);
});

test('Senden abgeschaltet: liest, schreibt aber nichts', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected({ sendNutrition: false }), meals: yesterdayMeals });
  assert.equal(await syncHealth({ client: c, store, now: NOW }), 'done');
  assert.equal(c.calls.writeDay.length, 0);
  assert.equal(store.state.vitals.length, 1);
});

test('Krankheitstag gestern: nichts schreiben', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected(), meals: yesterdayMeals, days: [{ dateKey: '2026-11-22', status: 'sick' }] });
  await syncHealth({ client: c, store, now: NOW });
  assert.equal(c.calls.writeDay.length, 0);
});

test('Fehler beim Lesen: still, kein Absturz, letzter Abgleich bleibt, Versuch wird vermerkt', async () => {
  const store = fakeStore({ health: connected({ lastSyncAt: 111 }) });
  assert.equal(await syncHealth({ client: fakeClient({ fail: true }), store, now: NOW }), 'failed');
  assert.equal(store.state.settings.health.lastSyncAt, 111);
  assert.equal(store.state.settings.health.lastAttemptAt, NOW);
  assert.deepEqual(store.state.settings.health.written, []);
});

test('geschriebene Tage: nur die letzten 14 bleiben gemerkt', async () => {
  const written = Array.from({ length: 14 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  const store = fakeStore({ health: connected({ written }), meals: yesterdayMeals });
  await syncHealth({ client: fakeClient(), store, now: NOW });
  const h = store.state.settings.health.written;
  assert.equal(h.length, 14);
  assert.equal(h.at(-1), '2026-11-22');
  assert.equal(h.includes('2026-11-01'), false);
});
