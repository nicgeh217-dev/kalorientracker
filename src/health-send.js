import { addDays } from './overview.js';
import { localDateKey } from './logic.js';

// Gegessenes an Health Connect senden: jede Mahlzeit einzeln mit ihrer Uhrzeit, sobald sie 3 Stunden alt ist.
// Das Plugin kann Einträge weder ändern noch löschen. Darum wird jede Mahlzeit nur einmal gesendet,
// und Änderungen danach werden nur angezeigt (changedSince), nicht nachgereicht.

const WAIT_MS = 3 * 3600 * 1000;
const DAYS_BACK = 7;
const KEEP = 200;

// Schlüssel einer Mahlzeit: Nummer plus Zeitstempel, damit nach dem Einspielen einer Sicherung keine Nummern verwechselt werden.
export const sentKey = (m) => `${m.id}:${m.timestamp}`;
const signature = (m) => `${Math.round(m.kcal ?? 0)}|${Math.round(m.protein ?? 0)}`;

export function mealsToSend({ meals, now, sent, days, writtenDays, immediately = false }) {
  const from = addDays(localDateKey(new Date(now)), -DAYS_BACK);
  const sick = new Set(days.filter((d) => d.status === 'sick').map((d) => d.dateKey));
  const skipDays = new Set(writtenDays); // diese Tage hat die frühere Tagessumme schon geschrieben
  return meals
    .filter((m) => m.dateKey >= from && !sick.has(m.dateKey) && !skipDays.has(m.dateKey))
    .filter((m) => (m.kcal ?? 0) > 0 && m.timestamp && !(sentKey(m) in sent))
    .filter((m) => immediately ? new Date(m.timestamp).getTime() <= now : now - new Date(m.timestamp).getTime() >= WAIT_MS)
    .map((m) => {
      const start = new Date(m.timestamp).getTime();
      return {
        id: m.id, key: sentKey(m), signature: signature(m), kcal: Math.round(m.kcal), protein: Math.round(m.protein ?? 0),
        startDate: new Date(start).toISOString(), endDate: new Date(start + 60000).toISOString(), // Health Connect braucht ein Ende nach dem Anfang
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// Nach dem Senden geänderte Mahlzeiten (Nummern). Bei Google steht noch der alte Wert.
export function changedSince(meals, sent) {
  return meals.filter((m) => sentKey(m) in sent && sent[sentKey(m)] !== signature(m)).map((m) => m.id);
}

export function trimSent(sent) {
  return Object.fromEntries(Object.entries(sent).slice(-KEEP));
}
