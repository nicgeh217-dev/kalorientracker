import { addDays } from './overview.js';
import { weekOf } from './week.js';
import { daysBetween } from './pet.js';

// Eine Einheit dauert höchstens vier Stunden: Wer abends pausiert und morgens weitermacht, hat nicht 1440 Minuten trainiert.
const MAX_DURATION_MIN = 240;

export const MUSCLES = ['Brust', 'Rücken', 'Beine', 'Schultern', 'Arme', 'Core', 'Ganzkörper'];

export const DEFAULT_EXERCISES = [
  { name: 'Kniebeugen', muscle: 'Beine' },
  { name: 'Bankdrücken', muscle: 'Brust' },
  { name: 'Kreuzheben', muscle: 'Rücken' },
  { name: 'Schulterdrücken', muscle: 'Schultern' },
  { name: 'Klimmzüge', muscle: 'Rücken' },
  { name: 'Rudern', muscle: 'Rücken' },
  { name: 'Bizeps-Curls', muscle: 'Arme' },
  { name: 'Plank', muscle: 'Core' },
];

const round1 = (n) => Math.round(n * 10) / 10;
const byId = (exercises) => new Map(exercises.map((e) => [e.id, e]));

// Geschätztes Maximum für eine Wiederholung (Epley). 0 kg = Körpergewicht = 0, ungültige Wiederholungen = null.
export function epley1RM(kg, reps) {
  if (!Number.isFinite(reps) || reps < 1 || !Number.isFinite(kg) || kg < 0) return null;
  return round1(kg * (1 + reps / 30));
}

const allSets = (workouts) => workouts.flatMap((w) => w.sets.map((s) => ({ ...s, dateKey: w.dateKey, startedAt: w.startedAt })));

export function personalRecords(workouts, exercises) {
  const names = byId(exercises);
  const best = new Map();
  for (const s of allSets(workouts)) {
    const e1 = epley1RM(s.kg, s.reps);
    if (!e1) continue; // null (ungültig) und 0 (Körpergewicht) zählen nicht
    const cur = best.get(s.exerciseId);
    if (!cur || e1 > cur.best1RM) best.set(s.exerciseId, { exerciseId: s.exerciseId, name: names.get(s.exerciseId)?.name ?? 'Übung', best1RM: e1, bestKg: s.kg, bestReps: s.reps });
  }
  return [...best.values()].sort((a, b) => b.best1RM - a.best1RM);
}

export function weeklySets(workouts, exercises, todayKey) {
  const names = byId(exercises);
  const from = addDays(todayKey, -7);
  const byMuscle = {};
  let total = 0;
  for (const s of allSets(workouts)) {
    if (s.dateKey <= from || s.dateKey > todayKey) continue;
    total += 1;
    const muscle = names.get(s.exerciseId)?.muscle ?? 'Ganzkörper';
    byMuscle[muscle] = (byMuscle[muscle] ?? 0) + 1;
  }
  return { total, byMuscle };
}

export function weeklySetSeries(workouts, todayKey, weeks = 8) {
  const lastMonday = weekOf(todayKey)[0];
  const starts = Array.from({ length: weeks }, (_, i) => addDays(lastMonday, (i - (weeks - 1)) * 7));
  const sets = new Map(starts.map((s) => [s, 0]));
  for (const w of workouts) {
    const start = weekOf(w.dateKey)[0];
    if (sets.has(start)) sets.set(start, sets.get(start) + w.sets.length);
  }
  return starts.map((weekStart) => ({ weekStart, sets: sets.get(weekStart) }));
}

export function muscleDistribution(workouts, exercises, todayKey, days = 30) {
  const names = byId(exercises);
  const from = addDays(todayKey, -days);
  const counts = {};
  let total = 0;
  for (const s of allSets(workouts)) {
    if (s.dateKey <= from || s.dateKey > todayKey) continue;
    const muscle = names.get(s.exerciseId)?.muscle ?? 'Ganzkörper';
    counts[muscle] = (counts[muscle] ?? 0) + 1;
    total += 1;
  }
  if (!total) return [];
  // Prozente nach dem Verfahren der größten Reste, damit die Summe genau 100 ergibt.
  const rows = Object.entries(counts).map(([muscle, n]) => ({ muscle, sets: n, exact: (n / total) * 100 }));
  for (const r of rows) r.percent = Math.floor(r.exact);
  let missing = 100 - rows.reduce((s, r) => s + r.percent, 0);
  for (const r of [...rows].sort((a, b) => (b.exact - b.percent) - (a.exact - a.percent))) {
    if (missing <= 0) break;
    r.percent += 1;
    missing -= 1;
  }
  return rows.sort((a, b) => b.sets - a.sets || b.percent - a.percent).map(({ muscle, sets, percent }) => ({ muscle, sets, percent }));
}

export function strengthCurve(workouts, exerciseId) {
  const perDay = new Map();
  for (const s of allSets(workouts)) {
    if (s.exerciseId !== exerciseId) continue;
    const e1 = epley1RM(s.kg, s.reps);
    if (!e1) continue;
    if (!perDay.has(s.dateKey) || e1 > perDay.get(s.dateKey)) perDay.set(s.dateKey, e1);
  }
  return [...perDay.entries()].map(([dateKey, best1RM]) => ({ dateKey, best1RM })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function lastSetsFor(workouts, exerciseId) {
  const withEx = workouts.filter((w) => w.sets.some((s) => s.exerciseId === exerciseId));
  if (!withEx.length) return [];
  const last = withEx.reduce((a, b) => (b.dateKey > a.dateKey || (b.dateKey === a.dateKey && (b.startedAt ?? 0) >= (a.startedAt ?? 0)) ? b : a));
  return last.sets.filter((s) => s.exerciseId === exerciseId).map((s) => ({ kg: s.kg, reps: s.reps }));
}

export function daysSinceMuscle(workouts, exercises, muscle, todayKey) {
  const names = byId(exercises);
  let latest = null;
  for (const s of allSets(workouts)) {
    if (names.get(s.exerciseId)?.muscle === muscle && (latest == null || s.dateKey > latest)) latest = s.dateKey;
  }
  return latest == null ? null : daysBetween(latest, todayKey);
}

// Rekord nur, wenn es schon früher Sätze dieser Übung gab und der neue Satz ein höheres geschätztes Maximum hat.
export function isNewRecord(workouts, exerciseId, set) {
  const mine = epley1RM(set.kg, set.reps);
  if (mine == null) return false;
  const prior = allSets(workouts).filter((s) => s.exerciseId === exerciseId).map((s) => epley1RM(s.kg, s.reps)).filter((v) => v != null);
  return prior.length > 0 && mine > Math.max(...prior);
}

export function workoutTitle(entries, exercises) {
  const names = byId(exercises);
  const counts = new Map();
  for (const e of entries) {
    const muscle = names.get(e.exerciseId)?.muscle;
    if (muscle) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m);
  return top.length ? top.join(' + ') : 'Training';
}

export const restRemaining = (startedAtMs, nowMs, totalSec) => Math.max(0, totalSec - Math.floor((nowMs - startedAtMs) / 1000));

export function draftToWorkout(draft, finishedAtMs, exercises) {
  const entries = draft.entries
    .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((s) => s.done && Number.isFinite(s.reps) && s.reps >= 1 && Number.isFinite(s.kg ?? 0) && (s.kg ?? 0) >= 0) }))
    .filter((e) => e.sets.length);
  return {
    dateKey: draft.dateKey,
    startedAt: draft.startedAt,
    durationMin: draft.manual ? null : Math.min(MAX_DURATION_MIN, Math.max(1, Math.round(((draft.lastActivityAt ?? finishedAtMs) - draft.startedAt) / 60000))),
    title: workoutTitle(entries, exercises),
    sets: entries.flatMap((e) => e.sets.map((s) => ({ exerciseId: e.exerciseId, kg: s.kg ?? 0, reps: s.reps }))),
  };
}
