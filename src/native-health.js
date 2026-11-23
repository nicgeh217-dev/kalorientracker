// Health Connect in der Android-App (Plugin @capgo/capacitor-health, Name "Health").
// Im Browser (PWA) passiert nichts. Fehler einzelner Werte bleiben hier: Fehlt ein Recht, ist nur dieser Wert null (nicht gelesen).

export const READ_TYPES = ['steps', 'calories', 'totalCalories', 'restingHeartRate', 'sleep', 'weight', 'workouts'];
export const WRITE_TYPES = ['dietaryEnergyConsumed', 'dietaryProtein'];
const MAX_WORKOUT_PAGES = 10;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const EMPTY = () => ({ steps: null, activeKcal: null, totalKcal: null, restingHr: null, sleep: null, weights: null, workouts: null });

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

  return {
    async available() {
      if (!native) return false;
      try { return Boolean((await call('isAvailable')).available); } catch { return false; }
    },
    async connect() {
      const r = await call('requestAuthorization', { read: READ_TYPES, write: WRITE_TYPES, requestHistoryAccess: true });
      return { read: r.readAuthorized ?? [], write: r.writeAuthorized ?? [] };
    },
    async readAll(range) {
      if (!native) return EMPTY();
      // Nacheinander statt gleichzeitig: Health Connect drosselt viele gleichzeitige Anfragen.
      // Stundenwerte statt 'day': Das Plugin zählt 'day' als 24 Stunden ab Start, nicht als Kalendertag.
      const steps = await aggregated('steps', 'sum', range);
      const activeKcal = await aggregated('calories', 'sum', range);
      const totalKcal = await weeklySamples('totalCalories', range);
      const restingHr = await aggregated('restingHeartRate', 'average', range);
      const sleep = await samples('sleep', range);
      const weights = await samples('weight', range);
      return { steps, activeKcal, totalKcal, restingHr, sleep, weights, workouts: await workouts(range) };
    },
    // Ein abgeschlossener Tag: Kalorien und Protein als je ein Eintrag über den ganzen Tag (Ortszeit).
    async writeDay({ dateKey, kcal, protein }) {
      if (!native) return;
      const [y, m, d] = dateKey.split('-').map(Number);
      const startDate = new Date(y, m - 1, d, 0, 0, 0).toISOString();
      const endDate = new Date(y, m - 1, d, 23, 59, 59).toISOString();
      await call('saveSample', { dataType: 'dietaryEnergyConsumed', value: kcal, startDate, endDate });
      // Scheitert nur das Protein, gilt der Tag trotzdem als geschrieben: sonst kämen die Kalorien beim nächsten Mal doppelt an.
      if (protein > 0) await call('saveSample', { dataType: 'dietaryProtein', value: protein, startDate, endDate }).catch(() => {});
    },
    openSettings: () => (native ? call('openHealthConnectSettings') : undefined),
    showPrivacy: () => (native ? call('showPrivacyPolicy') : undefined),
  };
}
