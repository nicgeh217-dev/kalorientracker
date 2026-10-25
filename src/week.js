import { addDays } from './overview.js';

// Sieben Tage, Montag bis Sonntag, die den Tag enthalten.
export function weekOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sonntag
  const monday = addDays(dateKey, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const shiftWeek = (dateKey, n) => addDays(dateKey, n * 7);
