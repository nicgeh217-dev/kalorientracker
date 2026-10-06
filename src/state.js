import { localDateKey } from './logic.js';
import { addDays } from './overview.js';

// Welcher Tag gerade angezeigt wird. null = "heute" (folgt dem Datum, auch über Mitternacht).
const state = { dateKey: null };

export const viewedDateKey = () => state.dateKey ?? localDateKey(new Date());
export const isViewingToday = () => viewedDateKey() === localDateKey(new Date());
export function setViewedDateKey(key) {
  const today = localDateKey(new Date());
  state.dateKey = key >= today ? null : key; // Zukunft gibt es nicht
}

export function dayLabel(dateKey) {
  const today = localDateKey(new Date());
  if (dateKey === today) return 'Heute';
  if (dateKey === addDays(today, -1)) return 'Gestern';
  if (dateKey === addDays(today, -2)) return 'Vorgestern';
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long' });
}

export function longDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Zeitstempel für eine neue Mahlzeit an einem Tag: heute = jetzt, sonst der Tag mit der aktuellen Uhrzeit.
export function timestampFor(dateKey) {
  const now = new Date();
  if (dateKey === localDateKey(now)) return now.toISOString();
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes()).toISOString();
}
