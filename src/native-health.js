// Health Connect in der Android-App (Plugin @capgo/capacitor-health, Name "Health").
// Im Browser (PWA) passiert nichts. Fehler einzelner Werte bleiben hier: Fehlt ein Recht, fehlt nur dieser Wert.

export const READ_TYPES = ['steps', 'calories', 'totalCalories', 'restingHeartRate', 'sleep', 'weight', 'workouts'];
export const WRITE_TYPES = ['dietaryEnergyConsumed', 'dietaryProtein'];
const MAX_WORKOUT_PAGES = 10;

const EMPTY = () => ({ steps: [], activeKcal: [], totalKcal: [], restingHr: [], sleep: [], weights: [], workouts: [] });

export function healthClient({ cap = globalThis.Capacitor } = {}) {
  const native = Boolean(cap?.isNativePlatform?.());
  const call = (method, options) => cap.nativePromise('Health', method, options);
  const safe = async (fn) => { try { return await fn(); } catch { return []; } };

  const aggregated = (dataType, aggregation, { start, end }) => safe(async () =>
    (await call('queryAggregated', { dataType, startDate: start, endDate: end, bucket: 'day', aggregation })).samples ?? []);
  const samples = (dataType, { start, end }) => safe(async () =>
    (await call('readSamples', { dataType, startDate: start, endDate: end, limit: 1000, ascending: true })).samples ?? []);

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
      const steps = await aggregated('steps', 'sum', range);
      const activeKcal = await aggregated('calories', 'sum', range);
      const totalKcal = await aggregated('totalCalories', 'sum', range);
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
      if (protein > 0) await call('saveSample', { dataType: 'dietaryProtein', value: protein, startDate, endDate });
    },
    openSettings: () => (native ? call('openHealthConnectSettings') : undefined),
    showPrivacy: () => (native ? call('showPrivacyPolicy') : undefined),
  };
}
