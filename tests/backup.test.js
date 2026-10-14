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
  assert.equal(b.version, 1);
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
  const b = { ...buildBackup(data, now), version: 2 };
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
