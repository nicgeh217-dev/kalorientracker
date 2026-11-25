import { addDays } from './overview.js';

// Die letzten sieben Tage bis einschließlich dateKey, älteste zuerst. avg: Schnitt nur über Tage mit Einträgen, sonst null.
export function lastDays(meals, dateKey, n = 7) {
  const keys = Array.from({ length: n }, (_, i) => addDays(dateKey, i - (n - 1)));
  const days = keys.map((k) => {
    const of = meals.filter((m) => m.dateKey === k);
    return { dateKey: k, kcal: Math.round(of.reduce((s, m) => s + (m.kcal ?? 0), 0)), meals: of.length };
  });
  const logged = days.filter((d) => d.meals > 0);
  days.avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : null;
  return days;
}

// Schlafminuten der letzten sieben Nächte, älteste zuerst. Fehlende Nächte zählen 0.
export function nightSeries(vitals, dateKey, n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const k = addDays(dateKey, i - (n - 1));
    return vitals.find((v) => v.dateKey === k)?.sleepMin ?? 0;
  });
}
