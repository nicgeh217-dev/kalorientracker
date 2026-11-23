import { localDateKey } from './logic.js';
import { addDays } from './overview.js';

// Werte aus Health Connect (Fitbit, Google Health) als Tageszusammenfassungen.
// Nur Zahlen zum Ansehen: keine Ziele, keine Bewertung, kein Einfluss auf Kalorienziel, Fuchs oder Serie.

const DAY_MS = 24 * 3600 * 1000;
const SYNC_EVERY_MS = 5 * 60 * 1000;
const FIRST_SYNC_DAYS = 90;
const RESYNC_DAYS = 3; // Fitbit liefert oft verspätet nach

export const dayKeyOf = (iso) => localDateKey(new Date(iso));

export function sumByDay(samples) {
  const out = {};
  for (const s of samples) {
    if (!Number.isFinite(s?.value)) continue;
    const key = dayKeyOf(s.startDate);
    out[key] = (out[key] ?? 0) + s.value;
  }
  return out;
}

// Letzter Wert je Tag (z. B. Ruhepuls), gerundet.
export function valueByDay(samples) {
  const out = {};
  const sorted = [...samples].filter((s) => Number.isFinite(s?.value)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const s of sorted) out[dayKeyOf(s.startDate)] = Math.round(s.value);
  return out;
}

const NOT_SLEEP = new Set(['awake', 'inBed']);

// Schlaf zählt für den Tag, an dem er endet. Wach- und Im-Bett-Phasen zählen nicht.
export function sleepByDay(samples) {
  const out = {};
  for (const s of samples) {
    const key = dayKeyOf(s.endDate);
    const day = out[key] ?? (out[key] = { sleepMin: 0, sleepStart: s.startDate, sleepEnd: s.endDate });
    const minutes = Array.isArray(s.stages) && s.stages.length
      ? s.stages.filter((st) => !NOT_SLEEP.has(st.stage)).reduce((sum, st) => sum + (st.durationMinutes ?? 0), 0)
      : (NOT_SLEEP.has(s.sleepState) ? 0 : (s.value ?? 0));
    day.sleepMin += minutes;
    if (s.startDate < day.sleepStart) day.sleepStart = s.startDate;
    if (s.endDate > day.sleepEnd) day.sleepEnd = s.endDate;
  }
  for (const day of Object.values(out)) day.sleepMin = Math.round(day.sleepMin);
  return out;
}

export const WORKOUT_LABELS = {
  running: 'Laufen', walking: 'Gehen', cycling: 'Radfahren', strengthTraining: 'Krafttraining', functionalStrengthTraining: 'Krafttraining',
  swimming: 'Schwimmen', swimmingPool: 'Schwimmen', hiking: 'Wandern', yoga: 'Yoga', elliptical: 'Crosstrainer', rowing: 'Rudern',
  stairClimbing: 'Treppensteigen', pilates: 'Pilates', dance: 'Tanzen', boxing: 'Boxen', soccer: 'Fußball', basketball: 'Basketball',
  badminton: 'Badminton', climbing: 'Klettern', jumpRope: 'Seilspringen', martialArts: 'Kampfsport', crossTraining: 'Cross-Training',
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
export function buildVitalsDays({ steps = [], activeKcal = [], totalKcal = [], restingHr = [], sleep = [], workouts = [] }, now) {
  const days = new Map();
  const day = (key) => days.get(key) ?? days.set(key, { dateKey: key }).get(key);
  const put = (field, byDay) => { for (const [key, v] of Object.entries(byDay)) day(key)[field] = Math.round(v); };
  put('steps', sumByDay(steps));
  put('activeKcal', sumByDay(activeKcal));
  put('totalKcal', sumByDay(totalKcal));
  put('restingHr', valueByDay(restingHr));
  for (const [key, s] of Object.entries(sleepByDay(sleep))) Object.assign(day(key), s);
  for (const w of workouts.map(toFitbitWorkout)) (day(dayKeyOf(w.start)).workouts ??= []).push(w);
  return [...days.values()].map((d) => ({ ...d, syncedAt: now })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
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
  if (lastSyncAt == null) return { start: new Date(now - FIRST_SYNC_DAYS * DAY_MS).toISOString(), end: new Date(now).toISOString() };
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - RESYNC_DAYS);
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
