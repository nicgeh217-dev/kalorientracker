// Kalender-Heatmap: zeigt, an welchen Tagen etwas eingetragen wurde. Die Stufe richtet sich nur nach der Anzahl der
// Einträge, nie nach Kalorien, damit nichts bewertet wird (wie beim Fuchs: Tracken zählt, nicht wie viel).

export const intensity = (count) => (count >= 4 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0);

export function shiftMonth({ year, month }, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

const pad = (n) => String(n).padStart(2, '0');

// counts: { 'YYYY-MM-DD': Anzahl Einträge }, weightDays: Set mit Tagen, an denen das Gewicht eingetragen wurde.
// Wochen beginnen am Montag. Leere Felder vor dem 1. und nach dem letzten Tag sind null.
// tracked/elapsed: Tage mit Einträgen bzw. bereits vergangene Tage dieses Monats (Zukunft zählt nicht).
export function monthGrid({ year, month, counts, weightDays, todayKey }) {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: lead }, () => null);
  let tracked = 0;
  let elapsed = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${pad(month)}-${pad(day)}`;
    const count = counts[dateKey] ?? 0;
    const isFuture = dateKey > todayKey;
    if (!isFuture) {
      elapsed += 1;
      if (count > 0) tracked += 1;
    }
    cells.push({ dateKey, day, count, level: intensity(count), weight: weightDays.has(dateKey), isToday: dateKey === todayKey, isFuture });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, tracked, elapsed };
}
