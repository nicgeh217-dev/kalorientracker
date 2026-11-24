// Health Connect in der Android-App (Plugin @capgo/capacitor-health, Name "Health").
// Im Browser (PWA) passiert nichts. Fehler einzelner Werte bleiben hier: Fehlt ein Recht, ist nur dieser Wert null (nicht gelesen).
// Nicht angefragte Werte fehlen im Ergebnis ganz (undefined).
import { METRICS } from './health-metrics.js';

export const READ_TYPES = METRICS.flatMap((m) => m.hc);
export const WRITE_TYPES = ['dietaryEnergyConsumed', 'dietaryProtein'];
const MAX_WORKOUT_PAGES = 10;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const EMPTY = () => ({});

export function healthClient({ cap = globalThis.Capacitor } = {}) {
  const native = Boolean(cap?.isNativePlatform?.());
  const call = (method, options) => cap.nativePromise('Health', method, options);
  const safe = async (fn) => { try { return await fn(); } catch { return null; } };

  const aggregated = (dataType, aggregation, { start, end }) => safe(async () =>
    (await call('queryAggregated', { dataType, startDate: start, endDate: end, bucket: 'hour', aggregation })).samples ?? []);
  const samples = (dataType, { start, end }) => safe(async () =>
    (await call('readSamples', { dataType, startDate: start, endDate: end, limit: 1000, ascending: true })).samples ?? []);

  // Gesamt-Kalorien lassen sich im Plugin nicht aggregieren: Einzelwerte wochenweise lesen (Fitbit schreibt viele kleine Einträge).
  async function weeklySamples(dataType, { start, end }) {
    return safe(async () => {
      const all = [];
      const endMs = new Date(end).getTime();
      for (let from = new Date(start).getTime(); from < endMs; from += WEEK_MS) {
        const to = Math.min(from + WEEK_MS, endMs);
        const r = await call('readSamples', { dataType, startDate: new Date(from).toISOString(), endDate: new Date(to).toISOString(), limit: 5000, ascending: true });
        all.push(...(r.samples ?? []));
      }
      return all;
    });
  }

  async function workouts({ start, end }) {
    return safe(async () => {
      const all = [];
      let anchor;
      for (let page = 0; page < MAX_WORKOUT_PAGES; page += 1) {
        const r = await call('queryWorkouts', { startDate: start, endDate: end, limit: 100, ascending: true, ...(anchor ? { anchor } : {}) });
        all.push(...(r.workouts ?? []));
        anchor = r.anchor;
        if (!anchor) break;
      }
      return all;
    });
  }

  // Health-Connect-Typ, Schlüssel im Ergebnis, Art des Lesens.
  const READERS = [
    ['steps', 'steps', (r) => aggregated('steps', 'sum', r)],
    ['distance', 'distance', (r) => aggregated('distance', 'sum', r)],
    ['flightsClimbed', 'floors', (r) => weeklySamples('flightsClimbed', r)],
    ['calories', 'activeKcal', (r) => aggregated('calories', 'sum', r)],
    ['totalCalories', 'totalKcal', (r) => weeklySamples('totalCalories', r)],
    ['restingHeartRate', 'restingHr', (r) => aggregated('restingHeartRate', 'average', r)],
    ['heartRate', 'hr', (r) => aggregated('heartRate', ['average', 'min', 'max'], r)],
    ['heartRateVariability', 'hrv', (r) => weeklySamples('heartRateVariability', r)],
    ['oxygenSaturation', 'spo2', (r) => weeklySamples('oxygenSaturation', r)],
    ['respiratoryRate', 'respRate', (r) => weeklySamples('respiratoryRate', r)],
    ['vo2Max', 'vo2max', (r) => weeklySamples('vo2Max', r)],
    ['sleep', 'sleep', (r) => samples('sleep', r)],
    ['bodyFat', 'bodyFat', (r) => weeklySamples('bodyFat', r)],
    ['weight', 'weights', (r) => samples('weight', r)],
    ['workouts', 'workouts', (r) => workouts(r)],
  ];

  return {
    async available() {
      if (!native) return false;
      try { return Boolean((await call('isAvailable')).available); } catch { return false; }
    },
    async connect(types = READ_TYPES) {
      const r = await call('requestAuthorization', { read: types, write: WRITE_TYPES, requestHistoryAccess: true });
      return { read: r.readAuthorized ?? [], write: r.writeAuthorized ?? [] };
    },
    // types: Health-Connect-Typen der eingeschalteten Werte (hcTypesFor). Ergebnis-Schlüssel wie in buildVitalsDays.
    async readAll(range, types = READ_TYPES) {
      if (!native) return EMPTY();
      const out = {};
      // Nacheinander statt gleichzeitig: Health Connect drosselt viele gleichzeitige Anfragen.
      // Stundenwerte statt 'day': Das Plugin zählt 'day' als 24 Stunden ab Start, nicht als Kalendertag.
      for (const type of READERS.filter(([t]) => types.includes(t))) {
        const [, key, read] = type;
        out[key] = await read(range);
      }
      return out;
    },
    // Eine Mahlzeit: Kalorien und Protein mit ihrer eigenen Uhrzeit (start/end als ISO-Zeit).
    async writeMeal({ kcal, protein, startDate, endDate }) {
      if (!native) return;
      await call('saveSample', { dataType: 'dietaryEnergyConsumed', value: kcal, startDate, endDate });
      // Scheitert nur das Protein, gilt die Mahlzeit trotzdem als gesendet: sonst kämen die Kalorien beim nächsten Mal doppelt an.
      if (protein > 0) await call('saveSample', { dataType: 'dietaryProtein', value: protein, startDate, endDate }).catch(() => {});
    },
    openSettings: () => (native ? call('openHealthConnectSettings') : undefined),
    showPrivacy: () => (native ? call('showPrivacyPolicy') : undefined),
  };
}
