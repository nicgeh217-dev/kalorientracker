import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFindings, allowedNumbers, checkHint, fallbackSentences } from '../src/insights.js';

const TODAY = '2026-11-24';
const key = (i) => { const d = new Date(2026, 10, 24 - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const meal = (dateKey, kcal, { protein = 50, hour = 12, sameDay = true } = {}) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  // Nachgetragen: Zeitstempel trägt den Zieltag mit der Uhrzeit des Nachtragens (wie timestampFor), createdAt den echten Tag.
  const ts = new Date(y, m - 1, d, hour).toISOString();
  const createdAt = new Date(y, m - 1, sameDay ? d : d + 1, hour).toISOString();
  return { dateKey, kcal, protein, timestamp: ts, createdAt };
};
const base = { meals: [], vitals: [], workouts: [], days: [], todayKey: TODAY };

// 6 kurze Nächte mit 2400 kcal, 6 lange Nächte mit 1900 kcal
function sleepData({ shortN = 6, longN = 6, shortKcal = 2400, longKcal = 1900 } = {}) {
  const meals = [];
  const vitals = [];
  for (let i = 1; i <= shortN; i += 1) { vitals.push({ dateKey: key(i), sleepMin: 320 }); meals.push(meal(key(i), shortKcal)); }
  for (let i = shortN + 1; i <= shortN + longN; i += 1) { vitals.push({ dateKey: key(i), sleepMin: 450 }); meals.push(meal(key(i), longKcal)); }
  return { meals, vitals };
}

test('sleep_kcal: kurze gegen lange Nächte, Mittelwerte, Tage, Unterschied', () => {
  const f = computeFindings({ ...base, ...sleepData() }).find((x) => x.id === 'sleep_kcal');
  assert.ok(f);
  assert.deepEqual([f.a.mean, f.a.n, f.b.mean, f.b.n, f.diff, f.pct, f.unit], [2400, 6, 1900, 6, 500, 26, 'kcal']);
  assert.deepEqual(f.thresholds, [6, 7]);
});

test('Schwellen: unter 5 Tagen je Gruppe oder unter 10 % Unterschied wird nichts gemeldet', () => {
  assert.equal(computeFindings({ ...base, ...sleepData({ shortN: 4 }) }).some((x) => x.id === 'sleep_kcal'), false);
  assert.equal(computeFindings({ ...base, ...sleepData({ shortKcal: 2000, longKcal: 1900 }) }).some((x) => x.id === 'sleep_kcal'), false);
});

test('Krankheitstage und Tage ohne Mahlzeit zählen nicht, heute auch nicht', () => {
  const data = sleepData();
  const sick = [1, 2].map((i) => ({ dateKey: key(i), status: 'sick' }));
  assert.equal(computeFindings({ ...base, ...data, days: sick }).some((x) => x.id === 'sleep_kcal'), false);
  const noMeals = { ...data, meals: data.meals.filter((m) => m.dateKey !== key(1) && m.dateKey !== key(2)) };
  assert.equal(computeFindings({ ...base, ...noMeals }).some((x) => x.id === 'sleep_kcal'), false);
  const withToday = { ...data, vitals: [...data.vitals, { dateKey: TODAY, sleepMin: 300 }], meals: [...data.meals, meal(TODAY, 9000)] };
  assert.equal(computeFindings({ ...base, ...withToday }).find((x) => x.id === 'sleep_kcal').a.mean, 2400);
});

test('late_sleep: spätes Essen gegen früheres, Schlaf der folgenden Nacht, nachgetragene Mahlzeiten zählen nicht', () => {
  const meals = [];
  const vitals = [];
  for (let i = 2; i <= 7; i += 1) { meals.push(meal(key(i), 2000, { hour: 22 })); vitals.push({ dateKey: key(i - 1), sleepMin: 360 }); }
  for (let i = 8; i <= 13; i += 1) { meals.push(meal(key(i), 2000, { hour: 19 })); vitals.push({ dateKey: key(i - 1), sleepMin: 450 }); }
  const f = computeFindings({ ...base, meals, vitals }).find((x) => x.id === 'late_sleep');
  assert.deepEqual([f.a.mean, f.b.mean, f.unit, f.thresholds], [6, 7.5, 'h', [21]]);
  const backfilled = meals.map((m, i) => (i < 6 ? meal(m.dateKey, 2000, { hour: 22, sameDay: false }) : m));
  assert.equal(computeFindings({ ...base, meals: backfilled, vitals }).some((x) => x.id === 'late_sleep'), false);
});

test('weekend_kcal: Samstag/Sonntag gegen Montag bis Freitag', () => {
  const meals = [];
  for (let i = 1; i <= 21; i += 1) {
    const dow = new Date(2026, 10, 24 - i).getDay();
    meals.push(meal(key(i), dow === 0 || dow === 6 ? 2600 : 2000));
  }
  const f = computeFindings({ ...base, meals }).find((x) => x.id === 'weekend_kcal');
  assert.deepEqual([f.a.mean, f.b.mean, f.a.n, f.b.n], [2600, 2000, 6, 15]);
});

test('training_sleep: Trainingstag gegen ohne, Schlaf der Nacht danach', () => {
  const workouts = [];
  const vitals = [];
  for (let i = 2; i <= 13; i += 1) {
    const trained = i <= 7;
    if (trained) workouts.push({ dateKey: key(i), sets: [{}] });
    vitals.push({ dateKey: key(i - 1), sleepMin: trained ? 480 : 400 });
  }
  const f = computeFindings({ ...base, workouts, vitals }).find((x) => x.id === 'training_sleep');
  assert.deepEqual([f.a.mean, f.b.mean, f.a.n, f.b.n], [8, 6.7, 6, 6]);
});

test('steps_kcal: über gegen unter dem Median', () => {
  const meals = [];
  const vitals = [];
  for (let i = 1; i <= 11; i += 1) {
    const high = i <= 5;
    vitals.push({ dateKey: key(i), steps: high ? 12000 : i === 6 ? 8000 : 4000 });
    meals.push(meal(key(i), high ? 2300 : 2000));
  }
  const f = computeFindings({ ...base, meals, vitals }).find((x) => x.id === 'steps_kcal');
  assert.deepEqual([f.a.mean, f.b.mean, f.a.n, f.b.n, f.thresholds], [2300, 2000, 5, 5, [8000]]);
});

test('Ergebnisse nach Unterschied sortiert, Gewicht kommt nicht vor', () => {
  const findings = computeFindings({ ...base, ...sleepData() });
  assert.ok(findings.every((x, i) => i === 0 || findings[i - 1].pct >= x.pct));
  assert.ok(findings.every((x) => !/gewicht/i.test(x.text)));
});

test('checkHint: nur gelieferte Zahlen, auch gerundet, und keine Druck-Wörter', () => {
  const f = computeFindings({ ...base, ...sleepData({ shortKcal: 2412, longKcal: 2000 }) }).find((x) => x.id === 'sleep_kcal');
  const allowed = allowedNumbers([f]);
  assert.equal(checkHint('Nach kurzen Nächten isst du rund 400 kcal mehr, im Schnitt 2.412 kcal.', allowed), true);
  assert.equal(checkHint('Nach Nächten unter 6 h waren es 21 % mehr.', allowed), true);
  assert.equal(checkHint('Du isst dann 2500 kcal.', allowed), false);
  assert.equal(checkHint('Du solltest früher schlafen gehen.', allowed), false);
  assert.equal(checkHint('Das ist nicht schlecht.', allowed), false);
  assert.equal(checkHint('Achte auf dein Gewicht.', allowed), false);
  assert.equal(checkHint('Wenn du magst, probier es mal mit einer festen Schlafenszeit.', allowed), true);
});

test('fallbackSentences: schlichte Sätze aus den Ergebnissen', () => {
  const f = computeFindings({ ...base, ...sleepData() }).find((x) => x.id === 'sleep_kcal');
  const [s] = fallbackSentences([f]);
  assert.match(s, /2\.400 kcal/);
  assert.match(s, /1\.900 kcal/);
  assert.match(s, /6 und 6 Tage/);
});

test('late_sleep: Mahlzeiten ohne Eintragezeit (alte Einträge) zählen nicht', () => {
  const meals = [];
  const vitals = [];
  for (let i = 2; i <= 13; i += 1) {
    const { createdAt, ...old } = meal(key(i), 2000, { hour: i <= 7 ? 22 : 19 });
    meals.push(old);
    vitals.push({ dateKey: key(i - 1), sleepMin: i <= 7 ? 360 : 450 });
  }
  assert.equal(computeFindings({ ...base, meals, vitals }).some((x) => x.id === 'late_sleep'), false);
});

test('abgeschaltete Werte fließen nicht in die Zusammenhänge ein', () => {
  const data = sleepData();
  assert.equal(computeFindings({ ...base, ...data, enabled: ['steps'] }).some((x) => x.id === 'sleep_kcal'), false);
  assert.equal(computeFindings({ ...base, ...data, enabled: ['sleep'] }).some((x) => x.id === 'sleep_kcal'), true);
});

test('checkHint: weitere Druck-Wörter, 8 Wochen ist erlaubt', () => {
  const f = computeFindings({ ...base, ...sleepData() }).find((x) => x.id === 'sleep_kcal');
  const allowed = allowedNumbers([f]);
  for (const t of ['Du solltest früher essen.', 'Vermeide spätes Essen.', 'Reduziere die Portionen.', 'Ein Defizit hilft.', 'Iss nicht zuviel.', 'Das darfst nicht passieren.', 'Man sollte schlafen.']) {
    assert.equal(checkHint(t, allowed), false, t);
  }
  assert.equal(checkHint('In den letzten 8 Wochen fällt auf, dass kurze Nächte und mehr Hunger zusammenhängen.', allowed), true);
});
