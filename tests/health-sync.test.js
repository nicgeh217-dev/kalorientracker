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
    listVitals: async () => state.vitals,
    putVitalsDays: async (list) => { for (const d of list) { state.vitals = state.vitals.filter((x) => x.dateKey !== d.dateKey).concat(d); } },
    listMeals: async () => state.meals,
    listDayStatuses: async () => state.days,
  };
}

function fakeClient({ fail = false, raw = null, writeFails = false } = {}) {
  const calls = { readAll: [], writeMeal: [] };
  return {
    calls,
    readAll: async (range) => {
      calls.readAll.push(range);
      if (fail) throw new Error('Health Connect fehlt');
      if (raw) return raw;
      return {
        steps: [{ startDate: iso(22), value: 8000 }], activeKcal: [], totalKcal: [], restingHr: [], sleep: [],
        weights: [{ startDate: iso(22, 7), value: 74.2 }], workouts: [],
      };
    },
    writeMeal: async (m) => { if (writeFails) throw new Error('kein Recht'); calls.writeMeal.push(m); },
  };
}

const connected = (extra = {}) => ({ connected: true, sendNutrition: true, written: [], ...extra });
const yesterdayMeals = [{ id: 1, dateKey: '2026-11-22', timestamp: iso(22, 12), kcal: 1800, protein: 90 }];

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

test('Erstabgleich: 90 Tage, speichert Tage, übernimmt Gewicht, sendet die Mahlzeit', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected(), meals: yesterdayMeals });
  assert.equal(await syncHealth({ client: c, store, now: NOW }), 'done');
  assert.equal(c.calls.readAll[0].start, new Date(2026, 7, 25).toISOString());
  assert.deepEqual(store.state.vitals.map((v) => [v.dateKey, v.steps]), [['2026-11-22', 8000]]);
  assert.deepEqual(store.state.weights, [{ date: '2026-11-22', kg: 74.2, source: 'health' }]);
  assert.deepEqual(c.calls.writeMeal.map((m) => [m.kcal, m.protein, m.startDate]), [[1800, 90, iso(22, 12)]]);
  const h = store.state.settings.health;
  assert.equal(h.lastSyncAt, NOW);
  assert.deepEqual(Object.values(h.sentMeals), ['1800|90']);
  assert.deepEqual([h.lastSend.ok, h.lastSend.count, h.lastSend.at], [true, 1, NOW]);
  assert.equal(store.state.settings.calorieGoal, 2000, 'andere Einstellungen bleiben');
});

test('danach nur noch die letzten Tage; Tage der früheren Tagessumme und schon gesendete Mahlzeiten werden nicht noch einmal gesendet', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected({ lastSyncAt: NOW - 3600000, lastAttemptAt: NOW - 3600000, written: ['2026-11-22'] }), meals: yesterdayMeals });
  await syncHealth({ client: c, store, now: NOW });
  assert.equal(c.calls.readAll[0].start, new Date(2026, 10, 20).toISOString());
  assert.equal(c.calls.writeMeal.length, 0);
});

test('Senden abgeschaltet: liest, schreibt aber nichts', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected({ sendNutrition: false }), meals: yesterdayMeals });
  assert.equal(await syncHealth({ client: c, store, now: NOW }), 'done');
  assert.equal(c.calls.writeMeal.length, 0);
  assert.equal(store.state.vitals.length, 1);
});

test('Krankheitstag: nichts senden', async () => {
  const c = fakeClient();
  const store = fakeStore({ health: connected(), meals: yesterdayMeals, days: [{ dateKey: '2026-11-22', status: 'sick' }] });
  await syncHealth({ client: c, store, now: NOW });
  assert.equal(c.calls.writeMeal.length, 0);
});

test('Fehler beim Lesen: still, kein Absturz, letzter Abgleich bleibt, Versuch wird vermerkt', async () => {
  const store = fakeStore({ health: connected({ lastSyncAt: 111 }) });
  assert.equal(await syncHealth({ client: fakeClient({ fail: true }), store, now: NOW }), 'failed');
  assert.equal(store.state.settings.health.lastSyncAt, 111);
  assert.equal(store.state.settings.health.lastAttemptAt, NOW);
  assert.equal(store.state.settings.health.sentMeals, undefined);
});

test('gesendete Mahlzeiten: nur die letzten 200 bleiben gemerkt', async () => {
  const sentMeals = {};
  for (let i = 0; i < 200; i += 1) sentMeals[`x${i}:t`] = '1|1';
  const store = fakeStore({ health: connected({ sentMeals }), meals: yesterdayMeals });
  await syncHealth({ client: fakeClient(), store, now: NOW });
  const h = store.state.settings.health.sentMeals;
  assert.equal(Object.keys(h).length, 200);
  assert.ok(Object.keys(h).some((k) => k.startsWith('1:')));
  assert.equal('x0:t' in h, false);
});

test('alles fehlgeschlagen: gilt als Fehlschlag, damit der 90-Tage-Abgleich wiederholt wird', async () => {
  const none = { steps: null, activeKcal: null, totalKcal: null, restingHr: null, sleep: null, weights: null, workouts: null };
  const store = fakeStore({ health: connected() });
  assert.equal(await syncHealth({ client: fakeClient({ raw: none }), store, now: NOW }), 'failed');
  assert.equal(store.state.settings.health.lastSyncAt, undefined);
});

test('ein Typ schlägt fehl: seine alten Werte bleiben, die anderen werden erneuert', async () => {
  const store = fakeStore({ health: connected({ lastSyncAt: NOW - 3600000, lastAttemptAt: NOW - 3600000 }) });
  store.state.vitals = [{ dateKey: '2026-11-22', steps: 5000, sleepMin: 420, syncedAt: 1 }];
  const raw = { steps: [{ startDate: iso(22), value: 9000 }], activeKcal: [], totalKcal: [], restingHr: [], sleep: null, weights: [], workouts: [] };
  assert.equal(await syncHealth({ client: fakeClient({ raw }), store, now: NOW }), 'done');
  assert.deepEqual(store.state.vitals.map((v) => [v.dateKey, v.steps, v.sleepMin]), [['2026-11-22', 9000, 420]]);
});

test('nur eingeschaltete Werte werden gelesen', async () => {
  let types = null;
  const client = { readAll: async (range, t) => { types = t; return { steps: [] }; }, writeDay: async () => {} };
  const store = fakeStore({ health: connected({ metrics: ['steps', 'hr'] }) });
  assert.equal(await syncHealth({ client, store, now: NOW }), 'done');
  assert.deepEqual(types, ['steps', 'heartRate']);
});

test('neue Werte zählen als gelesen und ersetzen ihre Felder', async () => {
  const store = fakeStore({ health: connected({ lastSyncAt: NOW - 3600000, lastAttemptAt: NOW - 3600000 }) });
  store.state.vitals = [{ dateKey: '2026-11-22', hrAvg: 70, hrMin: 50, hrMax: 140, syncedAt: 1 }];
  const raw = { hr: [{ startDate: iso(22, 9), values: { average: 80, min: 60, max: 150 } }] };
  await syncHealth({ client: fakeClient({ raw }), store, now: NOW });
  assert.deepEqual(store.state.vitals.map((v) => [v.hrAvg, v.hrMin, v.hrMax]), [[80, 60, 150]]);
});

test('alle Werte aus: nichts lesen, aber gegessene Kalorien trotzdem senden', async () => {
  let readCalled = false;
  const c = { calls: { writeMeal: [] }, readAll: async () => { readCalled = true; return {}; }, writeMeal: async (m) => { c.calls.writeMeal.push(m); } };
  const store = fakeStore({ health: connected({ metrics: [] }), meals: yesterdayMeals });
  assert.equal(await syncHealth({ client: c, store, now: NOW }), 'done');
  assert.equal(readCalled, false);
  assert.equal(c.calls.writeMeal.length, 1);
});

test('wird der Verlauf während eines Abgleichs zurückgesetzt (neue Rechte), überschreibt der Abgleich das nicht', async () => {
  const store = fakeStore({ health: connected({ lastSyncAt: NOW - 3600000, lastAttemptAt: NOW - 3600000 }) });
  const client = {
    readAll: async () => {
      // währenddessen: neue Rechte erteilt, Verlauf soll neu geladen werden
      store.state.settings = { ...store.state.settings, health: { ...store.state.settings.health, lastSyncAt: null } };
      return { steps: [] };
    },
    writeDay: async () => {},
  };
  await syncHealth({ client, store, now: NOW });
  assert.equal(store.state.settings.health.lastSyncAt, null);
});

test('Senden scheitert (Recht fehlt): Status merkt es, nichts wird als gesendet vermerkt, der Abgleich der Werte klappt trotzdem', async () => {
  const store = fakeStore({ health: connected(), meals: yesterdayMeals });
  assert.equal(await syncHealth({ client: fakeClient({ writeFails: true }), store, now: NOW }), 'done');
  const h = store.state.settings.health;
  assert.deepEqual([h.lastSend.ok, h.lastSend.count, h.lastSend.error], [false, 0, 'Recht fehlt oder Health Connect nicht erreichbar']);
  assert.equal(h.sentMeals, undefined);
  assert.equal(store.state.vitals.length, 1);
});

test('Sofort senden: auch Mahlzeiten unter 3 Stunden', async () => {
  const c = fakeClient();
  const recent = [{ id: 7, dateKey: '2026-11-23', timestamp: new Date(2026, 10, 23, 14, 30).toISOString(), kcal: 400, protein: 10 }];
  const store = fakeStore({ health: connected({ lastAttemptAt: NOW - 1000 }), meals: recent });
  assert.equal(await syncHealth({ client: c, store, now: NOW }), 'skipped');
  assert.equal(await syncHealth({ client: c, store, now: NOW, force: true }), 'done');
  assert.equal(c.calls.writeMeal.length, 0, 'wartet auf 3 Stunden');
  assert.equal(await syncHealth({ client: c, store, now: NOW, force: true, sendNow: true }), 'done');
  assert.equal(c.calls.writeMeal.length, 1);
});

test('nach dem Senden geänderte Mahlzeiten werden gezählt', async () => {
  const c = fakeClient();
  const meals = [{ id: 1, dateKey: '2026-11-22', timestamp: iso(22, 12), kcal: 1800, protein: 90 }];
  const store = fakeStore({ health: connected(), meals });
  await syncHealth({ client: c, store, now: NOW });
  meals[0] = { ...meals[0], kcal: 2000 };
  await syncHealth({ client: c, store, now: NOW + 600000 });
  assert.equal(c.calls.writeMeal.length, 1, 'nicht erneut gesendet');
  assert.equal(store.state.settings.health.lastSend.changed, 1);
});
