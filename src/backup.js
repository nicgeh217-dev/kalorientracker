import { localDateKey } from './logic.js';

// Gerätezustand (Key, letzte Sicherung, Snooze) gehört nicht in die Sicherungsdatei.
export function buildBackup(data, now) {
  const { geminiKey, lastBackupAt, backupSnoozedUntil, ...settings } = data.settings ?? {};
  return {
    version: 1,
    exportedAt: now.toISOString(),
    products: data.products,
    meals: data.meals,
    weights: data.weights,
    settings,
  };
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function parseBackup(text) {
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  if (!isObj(b) || b.version !== 1) {
    return { ok: false, error: 'Das ist keine Kalorientracker-Sicherung (Version 1).' };
  }
  for (const k of ['products', 'meals', 'weights']) {
    if (!Array.isArray(b[k])) return { ok: false, error: `Feld "${k}" fehlt oder ist ungültig.` };
  }
  if (!isObj(b.settings)) return { ok: false, error: 'Feld "settings" fehlt oder ist ungültig.' };
  if (!b.products.every((p) => isObj(p) && typeof p.name === 'string')) {
    return { ok: false, error: 'Ein Produkt in der Datei ist ungültig.' };
  }
  if (!b.meals.every((m) => isObj(m) && typeof m.timestamp === 'string' && typeof m.dateKey === 'string')) {
    return { ok: false, error: 'Eine Mahlzeit in der Datei ist ungültig (Zeitstempel fehlt).' };
  }
  if (!b.weights.every((w) => isObj(w) && typeof w.date === 'string' && typeof w.kg === 'number' && Number.isFinite(w.kg))) {
    return { ok: false, error: 'Ein Gewichtseintrag in der Datei ist ungültig.' };
  }
  return { ok: true, data: { products: b.products, meals: b.meals, weights: b.weights, settings: b.settings } };
}

const dayNumber = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Wann soll die App an eine Sicherung erinnern?
// - noch nie gesichert: ab 3 Tagen mit Daten ("never")
// - zuletzt vor >= 7 Tagen und seitdem neue Daten ("old")
// snoozedUntil: 'YYYY-MM-DD', bis zu diesem Tag (ausschließlich) ist die Erinnerung ausgeblendet.
export function backupReminder({ lastBackupAt, firstDataDate, lastDataDate, snoozedUntil, today = new Date() }) {
  if (!firstDataDate) return null;
  const todayKey = localDateKey(today);
  if (snoozedUntil && snoozedUntil > todayKey) return null;
  if (lastBackupAt) {
    const backupKey = localDateKey(new Date(lastBackupAt));
    const days = dayNumber(todayKey) - dayNumber(backupKey);
    return days >= 7 && lastDataDate && lastDataDate > backupKey ? { kind: 'old', days } : null;
  }
  const days = dayNumber(todayKey) - dayNumber(firstDataDate);
  return days >= 3 ? { kind: 'never', days } : null;
}
