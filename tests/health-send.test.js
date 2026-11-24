import test from 'node:test';
import assert from 'node:assert/strict';
import { mealsToSend, sentKey, changedSince, trimSent } from '../src/health-send.js';

const NOW = new Date(2026, 10, 24, 15, 0).getTime();
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const meal = (id, d, h, extra = {}) => ({ id, dateKey: `2026-11-${String(d).padStart(2, '0')}`, timestamp: at(d, h), kcal: 600, protein: 25, ...extra });

test('mealsToSend: Mahlzeiten ab 3 Stunden Alter, jede einzeln mit ihrer Uhrzeit', () => {
  const list = mealsToSend({ meals: [meal(1, 24, 11), meal(2, 24, 13), meal(3, 24, 8, { kcal: 300, protein: 0 })], now: NOW, sent: {}, days: [], writtenDays: [] });
  assert.deepEqual(list.map((m) => m.id), [3, 1], 'nach Uhrzeit sortiert');
  const m1 = list.find((m) => m.id === 1);
  assert.equal(m1.startDate, at(24, 11));
  assert.equal(m1.endDate, at(24, 11, 1));
  assert.deepEqual([m1.kcal, m1.protein], [600, 25]);
  assert.equal(m1.key, sentKey(meal(1, 24, 11)));
});

test('mealsToSend: sofort senden ignoriert die 3 Stunden', () => {
  const list = mealsToSend({ meals: [meal(1, 24, 14, { timestamp: at(24, 14, 30) })], now: NOW, sent: {}, days: [], writtenDays: [], immediately: true });
  assert.equal(list.length, 1);
});

test('mealsToSend: nichts doppelt, nichts Älteres als 7 Tage, nichts ohne Kalorien, keine Krankheitstage', () => {
  const sent = { [sentKey(meal(1, 24, 9))]: '600|25' };
  const meals = [meal(1, 24, 9), meal(2, 15, 12), meal(3, 23, 12, { kcal: 0 }), meal(4, 22, 12), meal(5, 21, 12)];
  const days = [{ dateKey: '2026-11-22', status: 'sick' }];
  assert.deepEqual(mealsToSend({ meals, now: NOW, sent, days, writtenDays: [] }).map((m) => m.id), [5]);
});

test('mealsToSend: Tage, die die frühere Tagessumme schon geschrieben hat, werden nicht noch einmal gesendet', () => {
  const list = mealsToSend({ meals: [meal(1, 23, 12), meal(2, 22, 12)], now: NOW, sent: {}, days: [], writtenDays: ['2026-11-23'] });
  assert.deepEqual(list.map((m) => m.id), [2]);
});

test('mealsToSend: nachgetragene Mahlzeiten (Zeitstempel in der Zukunft) warten, bis sie 3 Stunden alt sind', () => {
  const list = mealsToSend({ meals: [meal(1, 24, 16, { timestamp: at(24, 16) })], now: NOW, sent: {}, days: [], writtenDays: [] });
  assert.equal(list.length, 0);
});

test('changedSince: erkennt Mahlzeiten, die nach dem Senden geändert wurden', () => {
  const m = meal(1, 23, 12);
  const sent = { [sentKey(m)]: '600|25', [sentKey(meal(2, 23, 13))]: '500|20' };
  const meals = [{ ...m, kcal: 700 }, meal(2, 23, 13, { kcal: 500, protein: 20 })];
  assert.deepEqual(changedSince(meals, sent), [1]);
});

test('trimSent: nur die letzten 200 Einträge bleiben', () => {
  const sent = {};
  for (let i = 0; i < 230; i += 1) sent[`k${i}`] = 'x';
  const t = trimSent(sent);
  assert.equal(Object.keys(t).length, 200);
  assert.ok('k229' in t && !('k0' in t));
});
