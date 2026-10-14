import test from 'node:test';
import assert from 'node:assert/strict';
import { bmr, bmi, minHealthyWeight, currentAge, validateProfile, calculateTarget, suggestAdjustment } from '../src/calorie.js';
import { fastLossWarning } from '../src/overview.js';

const male = { sex: 'm', age: 30, heightCm: 180, activity: 'moderate' };

test('Mifflin-St Jeor: Referenzwerte (von Hand nachgerechnet)', () => {
  assert.equal(bmr({ sex: 'm', age: 30, heightCm: 180, weightKg: 80 }), 1780); // 800 + 1125 - 150 + 5
  assert.equal(Math.round(bmr({ sex: 'f', age: 25, heightCm: 165, weightKg: 60 }) * 100) / 100, 1345.25); // 600 + 1031,25 - 125 - 161
});

test('BMI und gesundes Mindestgewicht (BMI 18,5)', () => {
  assert.equal(bmi(80, 180), 24.7);
  assert.equal(minHealthyWeight(180), 59.9);
});

test('currentAge zählt volle Jahre seit der Berechnung', () => {
  const p = { age: 30, calcDate: '2026-10-06' };
  assert.equal(currentAge(p, new Date(2026, 11, 1)), 30);
  assert.equal(currentAge(p, new Date(2027, 9, 5)), 30);
  assert.equal(currentAge(p, new Date(2027, 9, 6)), 31);
});

test('validateProfile: unmögliche Eingaben', () => {
  assert.equal(validateProfile({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 'low' }).ok, true);
  for (const bad of [
    { sex: 'x', age: 30, heightCm: 180, weightKg: 80, activity: 'low' },
    { sex: 'm', age: 0, heightCm: 180, weightKg: 80, activity: 'low' },
    { sex: 'm', age: 30.5, heightCm: 180, weightKg: 80, activity: 'low' },
    { sex: 'm', age: 30, heightCm: 80, weightKg: 80, activity: 'low' },
    { sex: 'm', age: 30, heightCm: 180, weightKg: 10, activity: 'low' },
    { sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 'nix' },
  ]) {
    assert.equal(validateProfile(bad).ok, false, JSON.stringify(bad));
  }
});

test('Halten: Gesamtverbrauch = Grundumsatz x Faktor, auf 10 gerundet', () => {
  const r = calculateTarget(male, 80, 'hold');
  assert.equal(r.ok, true);
  assert.equal(r.bmr, 1780);
  assert.equal(r.tdee, 2848);
  assert.equal(r.target, 2850);
});

test('Moderat abnehmen: -500 kcal', () => {
  const r = calculateTarget(male, 80, 'loseMod');
  assert.equal(r.target, 2350);
  assert.equal(r.delta, -498);
  assert.equal(r.kgPerWeek, -0.5);
  assert.deepEqual(r.notes, []);
});

test('Zunehmen: +250 kcal', () => {
  assert.equal(calculateTarget(male, 80, 'gain').target, 3100);
});

test('Defizit ist auf 20 % des Gesamtverbrauchs begrenzt', () => {
  const r = calculateTarget({ sex: 'f', age: 25, heightCm: 165, activity: 'low' }, 60, 'loseMod');
  assert.equal(r.target, 1510); // 1883,35 - 376,67
  assert.ok(r.notes.includes('capped20'));
});

test('Untergrenze 1500 kcal (Männer) greift', () => {
  const r = calculateTarget({ sex: 'm', age: 70, heightCm: 165, activity: 'low' }, 55, 'loseMod');
  assert.equal(r.target, 1500);
  assert.ok(r.notes.includes('floor'));
});

test('Gesamtverbrauch unter der Untergrenze: kein Defizit möglich', () => {
  const r = calculateTarget({ sex: 'f', age: 80, heightCm: 150, activity: 'low' }, 42, 'loseMod');
  assert.equal(r.ok, true);
  assert.equal(r.target, 1120); // = Gesamtverbrauch 1115, gerundet
  assert.ok(r.notes.includes('noRoom'));
});

test('Unter 18: keine Berechnung', () => {
  assert.deepEqual(calculateTarget({ ...male, age: 17 }, 70, 'hold'), { ok: false, reason: 'under18' });
});

test('Untergewicht (BMI < 18,5): kein Abnehmen, Halten ist erlaubt', () => {
  const p = { sex: 'f', age: 25, heightCm: 170, activity: 'low' };
  assert.deepEqual(calculateTarget(p, 50, 'loseMod'), { ok: false, reason: 'underweight' });
  assert.deepEqual(calculateTarget(p, 50, 'loseSlow'), { ok: false, reason: 'underweight' });
  assert.equal(calculateTarget(p, 50, 'hold').ok, true);
});

test('Zielgewicht erreicht: wie Halten, mit Hinweis', () => {
  const r = calculateTarget(male, 70, 'loseMod', 70.2);
  assert.equal(r.target, 2690); // Halten bei 70 kg: 1680 x 1,6 = 2688
  assert.ok(r.notes.includes('reachedTarget'));
});

test('Ungültige Eingabe -> invalid', () => {
  assert.deepEqual(calculateTarget({ ...male, sex: 'x' }, 80, 'hold'), { ok: false, reason: 'invalid' });
  assert.deepEqual(calculateTarget(male, NaN, 'hold'), { ok: false, reason: 'invalid' });
});

const settings = (over = {}) => ({
  calorieGoal: 2350,
  autoGoal: true,
  targetWeight: null,
  suggestionDismissedWeight: null,
  calcProfile: { sex: 'm', age: 30, calcDate: '2026-10-06', heightCm: 180, activity: 'moderate', goal: 'loseMod', calcWeightKg: 80 },
  ...over,
});
const today = new Date(2026, 10, 20);

test('Vorschlag: Gewicht ist >= 1 kg gesunken -> neues, niedrigeres Ziel', () => {
  const s = suggestAdjustment({ settings: settings(), avgWeightKg: 77.6, today });
  assert.deepEqual({ from: s.from, to: s.to, weightKg: s.weightKg, reason: s.reason }, { from: 2350, to: 2310, weightKg: 77.6, reason: 'weight' });
});

test('Kein Vorschlag bei kleiner Gewichtsänderung', () => {
  assert.equal(suggestAdjustment({ settings: settings(), avgWeightKg: 79.5, today }), null);
});

test('Kein Vorschlag, wenn das Ziel manuell gesetzt ist oder kein Rechner genutzt wurde', () => {
  assert.equal(suggestAdjustment({ settings: settings({ autoGoal: false }), avgWeightKg: 77, today }), null);
  assert.equal(suggestAdjustment({ settings: settings({ calcProfile: null }), avgWeightKg: 77, today }), null);
});

test('Kein Vorschlag, wenn sich das Ziel kaum ändert', () => {
  assert.equal(suggestAdjustment({ settings: settings({ calorieGoal: 2310 }), avgWeightKg: 77.6, today }), null);
});

test('"Später" blendet den Vorschlag aus, bis sich das Gewicht um 0,5 kg weiterbewegt', () => {
  assert.equal(suggestAdjustment({ settings: settings({ suggestionDismissedWeight: 77.4 }), avgWeightKg: 77.6, today }), null);
  assert.notEqual(suggestAdjustment({ settings: settings({ suggestionDismissedWeight: 76.5 }), avgWeightKg: 77.6, today }), null);
});

test('Zielgewicht erreicht: Vorschlag auf Erhaltung', () => {
  const s = suggestAdjustment({ settings: settings({ targetWeight: 70 }), avgWeightKg: 70.1, today });
  assert.equal(s.reason, 'reachedTarget');
  assert.equal(s.to, 2690); // Halten bei 70,1 kg: bmr 1680,5 x 1,6 = 2688,8
});

test('Kein Vorschlag, wenn die Rechnung nicht möglich ist (z. B. Untergewicht)', () => {
  const s = settings({ calcProfile: { sex: 'f', age: 25, calcDate: '2026-10-06', heightCm: 170, activity: 'low', goal: 'loseMod', calcWeightKg: 60 } });
  assert.equal(suggestAdjustment({ settings: s, avgWeightKg: 50, today }), null);
});

const days = (n, start, perDay) => Array.from({ length: n }, (_, i) => ({
  date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
  kg: Math.round((start + perDay * i) * 100) / 100,
}));

test('Warnung bei zu schneller Abnahme (> 1 % pro Woche)', () => {
  const w = fastLossWarning(days(14, 80, -0.2)); // -1,4 kg/Woche bei ~78,7 kg
  assert.ok(w);
  assert.equal(w.perWeekKg, -1.4);
  assert.ok(w.percent > 1.5);
});

test('Keine Warnung bei moderatem Tempo, bei Zunahme oder zu wenig Daten', () => {
  assert.equal(fastLossWarning(days(14, 80, -0.05)), null);
  assert.equal(fastLossWarning(days(14, 80, 0.2)), null);
  assert.equal(fastLossWarning(days(3, 80, -0.5)), null);
  assert.equal(fastLossWarning([]), null);
});
