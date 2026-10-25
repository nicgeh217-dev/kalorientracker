import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup } from '../src/backup.js';

const data = {
  products: [{ id: 1, name: 'Kimbap', basis: 'per100g', kcal: 200 }],
  meals: [{ id: 1, timestamp: '2026-10-06T12:00:00.000Z', dateKey: '2026-10-06', kcal: 300 }],
  weights: [{ date: '2026-10-06', kg: 72.5 }],
  settings: { calorieGoal: 2200, geminiKey: 'SECRET' },
};
const now = new Date('2026-10-06T12:00:00Z');

test('buildBackup entfernt geminiKey', () => {
  const b = buildBackup(data, now);
  assert.equal(b.version, 2);
  assert.deepEqual(b.days, []);
  assert.equal(b.settings.calorieGoal, 2200);
  assert.ok(!('geminiKey' in b.settings));
  assert.equal(data.settings.geminiKey, 'SECRET');
});

test('Roundtrip ist ok', () => {
  const r = parseBackup(JSON.stringify(buildBackup(data, now)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.meals, data.meals);
});

test('kaputtes JSON -> Fehler', () => {
  assert.equal(parseBackup('{nope').ok, false);
});

test('fremde JSON-Datei -> Fehler', () => {
  assert.equal(parseBackup('{"hello":"world"}').ok, false);
  assert.equal(parseBackup('[1,2,3]').ok, false);
  assert.equal(parseBackup('null').ok, false);
});

test('falsche Version -> Fehler', () => {
  const b = { ...buildBackup(data, now), version: 3 };
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
});

test('meals kein Array -> Fehler', () => {
  const b = { ...buildBackup(data, now), meals: {} };
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
});

test('Mahlzeit ohne timestamp -> Fehler', () => {
  const b = buildBackup(data, now);
  b.meals = [{ id: 2, kcal: 5 }];
  const r = parseBackup(JSON.stringify(b));
  assert.equal(r.ok, false);
  assert.match(r.error, /Mahlzeit/);
});

test('Gewicht mit ungültigem kg -> Fehler', () => {
  const b = buildBackup(data, now);
  b.weights = [{ date: '2026-10-06', kg: 'viel' }];
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
});

import { backupReminder } from '../src/backup.js';

test('buildBackup entfernt Gerätezustand (letzte Sicherung, Snooze)', () => {
  const b = buildBackup({ ...data, settings: { ...data.settings, lastBackupAt: '2026-10-01T10:00:00.000Z', backupSnoozedUntil: '2026-10-20' } }, now);
  assert.ok(!('lastBackupAt' in b.settings));
  assert.ok(!('backupSnoozedUntil' in b.settings));
});

const today = new Date(2026, 9, 15); // 15.10.2026
const base = { lastBackupAt: null, firstDataDate: '2026-10-01', lastDataDate: '2026-10-14', snoozedUntil: null, today };

test('Erinnerung: keine Daten -> keine Erinnerung', () => {
  assert.equal(backupReminder({ ...base, firstDataDate: null, lastDataDate: null }), null);
});

test('Erinnerung: noch nie gesichert, Daten >= 3 Tage alt', () => {
  assert.deepEqual(backupReminder(base), { kind: 'never', days: 14 });
  assert.equal(backupReminder({ ...base, firstDataDate: '2026-10-13' }), null); // erst 2 Tage Daten
  assert.notEqual(backupReminder({ ...base, firstDataDate: '2026-10-12' }), null); // genau 3 Tage
});

test('Erinnerung: Sicherung >= 7 Tage alt und seitdem neue Daten', () => {
  const lastBackupAt = new Date(2026, 9, 8, 12, 0).toISOString(); // 7 Tage her
  assert.deepEqual(backupReminder({ ...base, lastBackupAt }), { kind: 'old', days: 7 });
});

test('Erinnerung: Sicherung jünger als 7 Tage -> keine', () => {
  const lastBackupAt = new Date(2026, 9, 9, 12, 0).toISOString(); // 6 Tage her
  assert.equal(backupReminder({ ...base, lastBackupAt }), null);
});

test('Erinnerung: alte Sicherung, aber seitdem keine neuen Daten -> keine', () => {
  const lastBackupAt = new Date(2026, 9, 1, 12, 0).toISOString();
  assert.equal(backupReminder({ ...base, lastBackupAt, lastDataDate: '2026-10-01' }), null);
});

test('Erinnerung: Später (Snooze) unterdrückt bis zum genannten Tag', () => {
  assert.equal(backupReminder({ ...base, snoozedUntil: '2026-10-18' }), null);
  assert.equal(backupReminder({ ...base, snoozedUntil: '2026-10-15' }) !== null, true); // Snooze gilt nur bis vor dem Tag
});

test('buildBackup entfernt trainingDraft und nimmt Training mit', () => {
  const b = buildBackup({ ...data, settings: { trainingDraft: { x: 1 }, calorieGoal: 1 }, days: [{ dateKey: '2026-10-06', status: 'rest' }], exercises: [{ id: 1, name: 'Bankdrücken' }], workouts: [{ id: 1, dateKey: '2026-10-06', sets: [] }] }, now);
  assert.ok(!('trainingDraft' in b.settings));
  assert.equal(b.days.length, 1);
  assert.equal(b.exercises.length, 1);
  assert.equal(b.workouts.length, 1);
});

test('Version-1-Datei wird gelesen, Training ist leer', () => {
  const v1 = { version: 1, exportedAt: 'x', products: data.products, meals: data.meals, weights: data.weights, settings: {} };
  const r = parseBackup(JSON.stringify(v1));
  assert.equal(r.ok, true);
  assert.deepEqual([r.data.days, r.data.exercises, r.data.workouts], [[], [], []]);
});

test('Version-2-Roundtrip bleibt gleich', () => {
  const full = { ...data, days: [{ dateKey: '2026-10-06', status: 'sick' }], exercises: [{ id: 1, name: 'Kniebeuge' }], workouts: [{ id: 1, dateKey: '2026-10-06', sets: [{ kg: 60, reps: 5 }] }] };
  const r = parseBackup(JSON.stringify(buildBackup(full, now)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.days, full.days);
  assert.deepEqual(r.data.exercises, full.exercises);
  assert.deepEqual(r.data.workouts, full.workouts);
});

test('ungültiger Tagesstatus, Einheit ohne sets, Übung ohne name -> Fehler', () => {
  const base = buildBackup(data, now);
  assert.equal(parseBackup(JSON.stringify({ ...base, days: [{ dateKey: '2026-10-06', status: 'x' }] })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ ...base, workouts: [{ id: 1, dateKey: '2026-10-06' }] })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ ...base, exercises: [{ id: 1 }] })).ok, false);
});
