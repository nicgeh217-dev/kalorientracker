import test from 'node:test';
import assert from 'node:assert/strict';
import { METRICS, enabledMetrics, hcTypesFor } from '../src/health-metrics.js';

const IDS = ['steps', 'distance', 'floors', 'kcal', 'restingHr', 'hr', 'hrv', 'spo2', 'respRate', 'vo2max', 'sleep', 'bodyFat', 'weight', 'workouts'];

test('Katalog: alle Werte aus der Spec', () => {
  assert.deepEqual(METRICS.map((m) => m.id), IDS);
});

test('enabledMetrics: ohne Auswahl alles, sonst die Auswahl', () => {
  assert.deepEqual(enabledMetrics({}), IDS);
  assert.deepEqual(enabledMetrics({ health: { connected: true } }), IDS);
  assert.deepEqual(enabledMetrics({ health: { metrics: ['steps', 'sleep'] } }), ['steps', 'sleep']);
});

test('hcTypesFor: Health-Connect-Typen der gewählten Werte', () => {
  assert.deepEqual(hcTypesFor(['kcal', 'hr', 'sleep']), ['calories', 'totalCalories', 'heartRate', 'sleep']);
  assert.deepEqual(hcTypesFor(['weight', 'workouts', 'floors']), ['flightsClimbed', 'weight', 'workouts'], 'Reihenfolge wie im Katalog');
});

test('jeder Wert: text und tile null ohne Daten, gefüllt mit Daten', () => {
  const full = {
    dateKey: '2026-11-22', steps: 8412, distanceM: 6200, floors: 12, totalKcal: 2410, restingHr: 57, hrAvg: 72, hrMin: 54, hrMax: 148,
    hrv: 42, spo2: 96, respRate: 14, vo2max: 44, sleepMin: 432, bodyFat: 18.4, workouts: [{ type: 'running' }],
  };
  for (const m of METRICS.filter((x) => x.id !== 'weight' && x.id !== 'workouts')) {
    assert.equal(m.text({ dateKey: 'x' }), null, m.id);
    assert.equal(m.tile({ dateKey: 'x' }), null, m.id);
    assert.equal(typeof m.text(full), 'string', m.id);
    assert.ok(m.tile(full)?.value, m.id);
  }
  const byId = Object.fromEntries(METRICS.map((m) => [m.id, m]));
  assert.equal(byId.distance.text(full), '6,2 km');
  assert.equal(byId.hr.text(full), 'Puls Ø 72 (54 bis 148)');
  assert.equal(byId.spo2.tile(full).unit, '%');
  assert.equal(byId.kcal.tile({ activeKcal: 300 }).label, 'aktiv verbrannt');
});
