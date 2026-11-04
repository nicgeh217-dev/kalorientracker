import { addDays } from './overview.js';

// Sieben Tage, Montag bis Sonntag, die den Tag enthalten.
export function weekOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sonntag
  const monday = addDays(dateKey, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const shiftWeek = (dateKey, n) => addDays(dateKey, n * 7);

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const dayOf = (key) => Number(key.slice(8, 10));
const monthOf = (key) => MONTHS[Number(key.slice(5, 7)) - 1];

export function weekTitle(dateKey) {
  const days = weekOf(dateKey);
  const [first, last] = [days[0], days[6]];
  return monthOf(first) === monthOf(last)
    ? `Woche vom ${dayOf(first)}. bis ${dayOf(last)}. ${monthOf(last)}`
    : `Woche vom ${dayOf(first)}. ${monthOf(first)} bis ${dayOf(last)}. ${monthOf(last)}`;
}

// Rückblick auf eine Woche: nur Zahlen zum Mitzählen. Bewusst ohne Ziel, Prozent oder Vergleich, damit nichts bewertet wird.
export function weekReview({ dateKey, meals, workouts, weights }) {
  const days = weekOf(dateKey);
  const inWeek = (key) => key >= days[0] && key <= days[6];
  const trained = workouts.filter((w) => w.sets.length && inWeek(w.dateKey));
  return {
    days,
    loggedDays: new Set(meals.filter((m) => inWeek(m.dateKey)).map((m) => m.dateKey)).size,
    trainingDays: new Set(trained.map((w) => w.dateKey)).size,
    sets: trained.reduce((n, w) => n + w.sets.length, 0),
    weights: weights.filter((w) => inWeek(w.date)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
