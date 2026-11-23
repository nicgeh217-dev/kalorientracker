import { localDateKey } from './logic.js';
import { addDays } from './overview.js';

// Werte aus Health Connect (Fitbit, Google Health) als Tageszusammenfassungen.
// Nur Zahlen zum Ansehen: keine Ziele, keine Bewertung, kein Einfluss auf Kalorienziel, Fuchs oder Serie.

const SYNC_EVERY_MS = 5 * 60 * 1000;
const FIRST_SYNC_DAYS = 90;
const RESYNC_DAYS = 3; // Fitbit liefert oft verspätet nach

export const dayKeyOf = (iso) => localDateKey(new Date(iso));

// Stundenwerte (Health Connect, bucket 'hour') zum Kalendertag nach Ortszeit zusammenzählen.
export function sumByDay(samples) {
  const out = {};
  for (const s of samples ?? []) {
    if (!Number.isFinite(s?.value)) continue;
    const key = dayKeyOf(s.startDate);
    out[key] = (out[key] ?? 0) + s.value;
  }
  return out;
}

// Mittelwert je Tag (Ruhepuls aus Stundenwerten), gerundet.
export function averageByDay(samples) {
  const acc = {};
  for (const s of samples ?? []) {
    if (!Number.isFinite(s?.value)) continue;
    const key = dayKeyOf(s.startDate);
    (acc[key] ??= []).push(s.value);
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
}

// Letzter Wert je Tag mit digits Nachkommastellen (z. B. Körperfett).
export function lastByDay(samples, digits = 0) {
  const f = 10 ** digits;
  const out = {};
  const sorted = [...(samples ?? [])].filter((s) => Number.isFinite(s?.value)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const s of sorted) out[dayKeyOf(s.startDate)] = Math.round(s.value * f) / f;
  return out;
}

// Puls aus Stundenwerten: Min und Max des Tages exakt, Ø als Mittel der Stundenmittel.
export function heartRateByDay(samples) {
  const acc = {};
  for (const s of samples ?? []) {
    const v = s?.values ?? {};
    if (!Number.isFinite(v.average)) continue;
    const d = (acc[dayKeyOf(s.startDate)] ??= { sum: 0, n: 0, min: Infinity, max: -Infinity });
    d.sum += v.average;
    d.n += 1;
    if (Number.isFinite(v.min)) d.min = Math.min(d.min, v.min);
    if (Number.isFinite(v.max)) d.max = Math.max(d.max, v.max);
  }
  return Object.fromEntries(Object.entries(acc).map(([k, d]) => [k, {
    hrAvg: Math.round(d.sum / d.n),
    ...(Number.isFinite(d.min) ? { hrMin: Math.round(d.min) } : {}),
    ...(Number.isFinite(d.max) ? { hrMax: Math.round(d.max) } : {}),
  }]));
}

// Letzter Wert je Tag, gerundet.
export function valueByDay(samples) {
  const out = {};
  const sorted = [...(samples ?? [])].filter((s) => Number.isFinite(s?.value)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const s of sorted) out[dayKeyOf(s.startDate)] = Math.round(s.value);
  return out;
}

const NOT_SLEEP = new Set(['awake', 'inBed']);
const PHASES = { deep: 'sleepDeep', rem: 'sleepRem', light: 'sleepLight', awake: 'sleepAwake' };
// Aus Start und Ende rechnen: Das Plugin rundet durationMinutes je Phase ab, bei vielen Phasen fehlen sonst 10 bis 20 Minuten.
const stageMinutes = (st) => {
  const ms = new Date(st.endDate).getTime() - new Date(st.startDate).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms / 60000 : (st.durationMinutes ?? 0);
};

// Schlaf zählt für den Tag, an dem er endet. Wach- und Im-Bett-Phasen zählen nicht.
export function sleepByDay(samples) {
  const out = {};
  for (const s of samples ?? []) {
    const key = dayKeyOf(s.endDate);
    const day = out[key] ?? (out[key] = { sleepMin: 0, sleepStart: s.startDate, sleepEnd: s.endDate });
    const minutes = Array.isArray(s.stages) && s.stages.length
      ? s.stages.filter((st) => !NOT_SLEEP.has(st.stage)).reduce((sum, st) => sum + stageMinutes(st), 0)
      : (NOT_SLEEP.has(s.sleepState) ? 0 : (s.value ?? 0));
    day.sleepMin += minutes;
    // Phasen nur, wenn die Fitbit sie liefert (Tief, REM, Leicht, Wach).
    for (const st of Array.isArray(s.stages) ? s.stages : []) {
      const field = PHASES[st.stage];
      if (field) day[field] = (day[field] ?? 0) + stageMinutes(st);
    }
    if (s.startDate < day.sleepStart) day.sleepStart = s.startDate;
    if (s.endDate > day.sleepEnd) day.sleepEnd = s.endDate;
  }
  for (const day of Object.values(out)) {
    for (const f of ['sleepMin', ...Object.values(PHASES)]) if (f in day) day[f] = Math.round(day[f]);
    if (!['sleepDeep', 'sleepRem', 'sleepLight'].some((f) => f in day)) delete day.sleepAwake;
  }
  return out;
}

export const WORKOUT_LABELS = {
  running: 'Laufen', walking: 'Gehen', cycling: 'Radfahren', strengthTraining: 'Krafttraining', functionalStrengthTraining: 'Krafttraining',
  swimming: 'Schwimmen', swimmingPool: 'Schwimmen', hiking: 'Wandern', yoga: 'Yoga', elliptical: 'Crosstrainer', rowing: 'Rudern',
  stairClimbing: 'Treppensteigen', pilates: 'Pilates', dance: 'Tanzen', boxing: 'Boxen', soccer: 'Fußball', basketball: 'Basketball',
  badminton: 'Badminton', climbing: 'Klettern', jumpRope: 'Seilspringen', martialArts: 'Kampfsport', crossTraining: 'Cross-Training',
  weightlifting: 'Krafttraining', runningTreadmill: 'Laufband', bikingStationary: 'Ergometer', other: 'Training',
};

export function toFitbitWorkout(w) {
  return {
    type: w.workoutType,
    title: WORKOUT_LABELS[w.workoutType] ?? 'Training',
    start: w.startDate,
    end: w.endDate,
    durationMin: Math.round((w.duration ?? 0) / 60),
    kcal: Number.isFinite(w.totalEnergyBurned) ? Math.round(w.totalEnergyBurned) : null,
  };
}

// Ein Datensatz je Tag, an dem irgendein Wert existiert. Fehlende Werte bleiben weg.
export function buildVitalsDays({
  steps, activeKcal, totalKcal, restingHr, sleep, workouts, distance, floors, hr, hrv, spo2, respRate, vo2max, bodyFat,
}, now) {
  const days = new Map();
  const day = (key) => days.get(key) ?? days.set(key, { dateKey: key }).get(key);
  const put = (field, byDay) => { for (const [key, v] of Object.entries(byDay)) day(key)[field] = Math.round(v); };
  put('steps', sumByDay(steps));
  put('activeKcal', sumByDay(activeKcal));
  put('totalKcal', sumByDay(totalKcal));
  put('restingHr', averageByDay(restingHr));
  put('distanceM', sumByDay(distance));
  put('floors', sumByDay(floors));
  put('hrv', averageByDay(hrv));
  put('spo2', averageByDay(spo2));
  put('respRate', averageByDay(respRate));
  put('vo2max', lastByDay(vo2max));
  for (const [key, v] of Object.entries(lastByDay(bodyFat, 1))) day(key).bodyFat = v;
  for (const [key, v] of Object.entries(heartRateByDay(hr))) Object.assign(day(key), v);
  for (const [key, s] of Object.entries(sleepByDay(sleep))) Object.assign(day(key), s);
  for (const w of (workouts ?? []).map(toFitbitWorkout)) (day(dayKeyOf(w.start)).workouts ??= []).push(w);
  return [...days.values()].map((d) => ({ ...d, syncedAt: now })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

// Welche Felder gehören zu welchem gelesenen Typ (siehe native-health.js, readAll).
const FIELDS = {
  steps: ['steps'], activeKcal: ['activeKcal'], totalKcal: ['totalKcal'], restingHr: ['restingHr'],
  sleep: ['sleepMin', 'sleepStart', 'sleepEnd', 'sleepDeep', 'sleepRem', 'sleepLight', 'sleepAwake'], workouts: ['workouts'],
  distance: ['distanceM'], floors: ['floors'], hr: ['hrAvg', 'hrMin', 'hrMax'], hrv: ['hrv'], spo2: ['spo2'], respRate: ['respRate'],
  vo2max: ['vo2max'], bodyFat: ['bodyFat'],
};

// Neue Werte in die gespeicherten einarbeiten. Nur Typen, die erfolgreich gelesen wurden (read), ersetzen ihre Felder,
// und nur für Tage im Abgleich-Zeitraum (from bis to). Fehlgeschlagene Typen behalten ihre alten Werte.
export function mergeVitalsDays(existing, fresh, { read, from, to, now }) {
  const byDay = new Map(existing.map((d) => [d.dateKey, { ...d }]));
  for (const [key, d] of byDay) {
    if (key < from || key > to) continue;
    for (const type of read) for (const f of FIELDS[type] ?? []) delete d[f];
    d.syncedAt = now;
  }
  for (const f of fresh) {
    const d = byDay.get(f.dateKey) ?? { dateKey: f.dateKey };
    byDay.set(f.dateKey, { ...d, ...f, syncedAt: now });
  }
  return [...byDay.values()]
    .filter((d) => d.dateKey >= from && d.dateKey <= to)
    .filter((d) => Object.keys(d).some((k) => k !== 'dateKey' && k !== 'syncedAt'))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

// Fitbit-Trainings, die sich zeitlich mit einer Einheit aus der App überschneiden, gelten als dieselbe Einheit: die App gewinnt.
export function visibleFitbitWorkouts(fitbit, appWorkouts) {
  const spans = appWorkouts
    .filter((w) => w.durationMin != null && Number.isFinite(w.startedAt))
    .map((w) => [w.startedAt, w.startedAt + w.durationMin * 60000]);
  return fitbit.filter((f) => {
    const a = new Date(f.start).getTime();
    const b = new Date(f.end).getTime();
    return !spans.some(([s, e]) => a < e && s < b);
  });
}

// Tage mit einem echten Fitbit-Training. Gehen zählt nicht (Fitbit erkennt Spaziergänge von selbst).
export function fitbitTrainingDays(vitalsDays, appWorkouts) {
  return vitalsDays
    .filter((d) => visibleFitbitWorkouts(d.workouts ?? [], appWorkouts).some((w) => w.type !== 'walking'))
    .map((d) => d.dateKey);
}

// Gewichte aus Health Connect: das früheste je Tag. Ein in der App eingetragenes Gewicht gewinnt immer.
export function weightsToImport(samples, appWeights) {
  const app = new Map(appWeights.map((w) => [w.date, w]));
  const earliest = new Map();
  for (const s of [...samples].filter((x) => Number.isFinite(x?.value)).sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const key = dayKeyOf(s.startDate);
    if (!earliest.has(key)) earliest.set(key, Math.round(s.value * 10) / 10);
  }
  const out = [];
  for (const [date, kg] of earliest) {
    const own = app.get(date);
    if (own && own.source !== 'health') continue;
    if (own && own.kg === kg) continue;
    out.push({ date, kg, source: 'health' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Welcher Tag geht an Health Connect? Nur der abgeschlossene Vortag, einmal, und nicht leer oder krank (sonst stünde bei Google eine falsche 0).
export function dayToWrite({ todayKey, meals, status, written }) {
  const dateKey = addDays(todayKey, -1);
  if (written.includes(dateKey) || status === 'sick') return null;
  const day = meals.filter((m) => m.dateKey === dateKey);
  if (!day.length) return null;
  const sum = (k) => Math.round(day.reduce((s, m) => s + (m[k] ?? 0), 0));
  return { dateKey, kcal: sum('kcal'), protein: sum('protein') };
}

export function syncWindow({ lastSyncAt, now }) {
  // Immer ab Mitternacht (Ortszeit): Die Stundenwerte sollen ganze Kalendertage ergeben.
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (lastSyncAt == null ? FIRST_SYNC_DAYS : RESYNC_DAYS));
  return { start: start.toISOString(), end: today.toISOString() };
}

export const shouldSync = (lastAttemptAt, now) => lastAttemptAt == null || now - lastAttemptAt >= SYNC_EVERY_MS;

export function formatSleep(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function avgSteps(vitalsDays, dateKeys) {
  const wanted = new Set(dateKeys);
  const values = vitalsDays.filter((d) => wanted.has(d.dateKey) && Number.isFinite(d.steps)).map((d) => d.steps);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}
