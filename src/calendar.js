import { weekOf, shiftWeek } from './week.js';

// Jahres-Heatmap: zeigt, an welchen Tagen etwas eingetragen wurde. Die Stufe richtet sich nur nach der Anzahl der
// Einträge, nie nach Kalorien, damit nichts bewertet wird (wie beim Fuchs: Tracken zählt, nicht wie viel).

export const intensity = (count) => (count >= 4 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0);

// counts: { 'YYYY-MM-DD': Anzahl Einträge }, statuses: { 'YYYY-MM-DD': 'rest' | 'sick' }.
// 53 Wochen (Spalten) zu je 7 Tagen, Montag bis Sonntag; die letzte Woche enthält heute.
// tracked: vergangene Tage (inklusive heute) mit Einträgen innerhalb dieser Wochen.
export function yearGrid({ counts, statuses, todayKey }) {
  const lastMonday = weekOf(todayKey)[0];
  let tracked = 0;
  const weeks = Array.from({ length: 53 }, (_, i) => weekOf(shiftWeek(lastMonday, i - 52)).map((dateKey) => {
    const count = counts[dateKey] ?? 0;
    const isFuture = dateKey > todayKey;
    if (!isFuture && count > 0) tracked += 1;
    return { dateKey, level: intensity(count), status: statuses[dateKey] ?? null, isFuture, isToday: dateKey === todayKey };
  }));
  return { weeks, tracked };
}
