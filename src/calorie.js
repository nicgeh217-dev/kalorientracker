// Kalorienrechner: Grundumsatz (Mifflin-St Jeor) x Aktivitätsfaktor, Ziel (halten/abnehmen/zunehmen) mit Schutzgrenzen.
// Das Ergebnis ist ein Startwert mit Abweichungen von ±10-20 % im Einzelfall und keine medizinische Beratung.

// Aktivitätsfaktoren nach EFSA (1,4 / 1,6 / 1,8 / 2,0). Die Zuordnung zu Trainings pro Woche ist ein pragmatischer Vorschlag.
export const ACTIVITY = [
  { id: 'low', pal: 1.4, label: 'Gering', hint: 'Überwiegend sitzend, 0–1 Training pro Woche' },
  { id: 'moderate', pal: 1.6, label: 'Mäßig', hint: '2–3 Trainings pro Woche oder viel Gehen und Stehen im Alltag' },
  { id: 'active', pal: 1.8, label: 'Aktiv', hint: '4–5 Trainings pro Woche' },
  { id: 'very', pal: 2.0, label: 'Sehr aktiv', hint: '6–7 Trainings pro Woche oder körperlich harte Arbeit' },
];

export const GOALS = [
  { id: 'hold', delta: 0, label: 'Gewicht halten' },
  { id: 'loseSlow', delta: -250, label: 'Langsam abnehmen', hint: 'ca. −250 kcal pro Tag' },
  { id: 'loseMod', delta: -500, label: 'Moderat abnehmen', hint: 'ca. −500 kcal pro Tag' },
  { id: 'gain', delta: 250, label: 'Zunehmen', hint: 'ca. +250 kcal pro Tag' },
];

const MAX_DEFICIT_SHARE = 0.2; // Defizit höchstens 20 % des Gesamtverbrauchs
const MIN_BMI = 18.5;
const KCAL_PER_KG = 7700; // grobe Faustregel, überschätzt die Abnahme (siehe Hall et al.)

const round1 = (n) => Math.round(n * 10) / 10;
const round10 = (n) => Math.round(n / 10) * 10;

export function bmr({ sex, age, heightCm, weightKg }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
}

export const bmi = (weightKg, heightCm) => round1(weightKg / (heightCm / 100) ** 2);
export const minHealthyWeight = (heightCm) => round1(MIN_BMI * (heightCm / 100) ** 2);

// Alter zum heutigen Tag: Alter bei der Berechnung + volle Jahre seither.
export function currentAge(profile, today = new Date()) {
  const [y, m, d] = profile.calcDate.split('-').map(Number);
  let years = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) years -= 1;
  return profile.age + Math.max(0, years);
}

export function validateProfile({ sex, age, heightCm, weightKg, activity }) {
  const errors = {};
  if (sex !== 'm' && sex !== 'f') errors.sex = 'Bitte Geschlecht wählen.';
  if (!Number.isInteger(age) || age < 1 || age > 120) errors.age = 'Bitte ein gültiges Alter eingeben.';
  if (!(heightCm >= 120 && heightCm <= 230)) errors.heightCm = 'Größe zwischen 120 und 230 cm.';
  if (!(weightKg >= 30 && weightKg <= 300)) errors.weightKg = 'Gewicht zwischen 30 und 300 kg.';
  if (!ACTIVITY.some((a) => a.id === activity)) errors.activity = 'Bitte Aktivität wählen.';
  return { ok: Object.keys(errors).length === 0, errors };
}

// profile: { sex: 'm'|'f', age, heightCm, activity }; targetWeight optional (kg).
// ok:false -> reason: 'invalid' | 'under18' | 'underweight'
// ok:true  -> { bmr, pal, tdee, delta, target, kgPerWeek, goalId, notes }
//   notes: 'capped20' (Defizit auf 20 % begrenzt), 'floor' (Mindestwert), 'noRoom' (kein Defizit möglich), 'reachedTarget'
export function calculateTarget(profile, weightKg, goalId, targetWeight = null) {
  const input = { ...profile, weightKg };
  if (!validateProfile(input).ok) return { ok: false, reason: 'invalid' };
  if (profile.age < 18) return { ok: false, reason: 'under18' };

  const goal = GOALS.find((g) => g.id === goalId);
  if (!goal) return { ok: false, reason: 'invalid' };
  const wantsLoss = goal.delta < 0;
  if (wantsLoss && bmi(weightKg, profile.heightCm) < MIN_BMI) return { ok: false, reason: 'underweight' };

  const notes = [];
  let effective = goal;
  if (wantsLoss && targetWeight != null && weightKg <= targetWeight + 0.3) {
    effective = GOALS.find((g) => g.id === 'hold');
    notes.push('reachedTarget');
  }

  const base = bmr(input);
  const pal = ACTIVITY.find((a) => a.id === profile.activity).pal;
  const tdee = base * pal;

  let raw = tdee + effective.delta;
  if (effective.delta < 0) {
    const capped = Math.min(-effective.delta, MAX_DEFICIT_SHARE * tdee);
    if (capped < -effective.delta) notes.push('capped20');
    raw = tdee - capped;
    const floor = Math.max(profile.sex === 'm' ? 1500 : 1200, base);
    if (floor >= tdee) {
      raw = tdee;
      notes.push('noRoom');
    } else if (raw < floor) {
      raw = floor;
      notes.push('floor');
    }
  }

  const target = round10(raw);
  const delta = target - Math.round(tdee);
  return { ok: true, bmr: Math.round(base), pal, tdee: Math.round(tdee), delta, target, kgPerWeek: round1((delta * 7) / KCAL_PER_KG), goalId: effective.id, notes };
}

// Schlägt ein neues Tagesziel vor, wenn sich das Gewicht seit der letzten Rechnung um >= 1 kg verändert hat
// (oder das Zielgewicht erreicht ist). Wird nie automatisch übernommen, der Nutzer bestätigt.
export function suggestAdjustment({ settings, avgWeightKg, today = new Date() }) {
  const { calcProfile: p, autoGoal, calorieGoal, targetWeight = null, suggestionDismissedWeight: dismissed = null } = settings;
  if (!p || !autoGoal || calorieGoal == null || avgWeightKg == null) return null;

  const profile = { sex: p.sex, age: currentAge(p, today), heightCm: p.heightCm, activity: p.activity };
  const calc = calculateTarget(profile, avgWeightKg, p.goal, targetWeight);
  if (!calc.ok) return null;

  const reachedNow = calc.notes.includes('reachedTarget');
  const weightMoved = Math.abs(avgWeightKg - p.calcWeightKg) >= 1;
  if (!weightMoved && !reachedNow) return null;
  if (Math.abs(calc.target - calorieGoal) < 30) return null;
  if (dismissed != null && Math.abs(avgWeightKg - dismissed) < 0.5) return null;

  return { from: calorieGoal, to: calc.target, weightKg: avgWeightKg, reason: reachedNow ? 'reachedTarget' : 'weight', calc };
}
