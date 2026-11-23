import { localDateKey } from './logic.js';
import { addDays } from './overview.js';
import { buildVitalsDays, mergeVitalsDays, weightsToImport, dayToWrite, syncWindow, shouldSync, dayKeyOf } from './vitals.js';
import { enabledMetrics, hcTypesFor } from './health-metrics.js';

const KEEP_WRITTEN = 14;
// Ergebnis-Schlüssel von readAll, die in die Tageswerte gehen (Gewicht wird getrennt übernommen).
const VITAL_TYPES = ['steps', 'activeKcal', 'totalKcal', 'restingHr', 'sleep', 'workouts', 'distance', 'floors', 'hr', 'hrv', 'spo2', 'respRate', 'vo2max', 'bodyFat'];

// Abgleich mit Health Connect: Werte lesen, Gewichte übernehmen, den abgeschlossenen Vortag zurückschreiben.
// Wirft nie. Ergebnis: 'skipped' (nicht verbunden oder zu früh), 'done' oder 'failed' (still, der nächste Versuch holt es nach).
// store kapselt die Datenbank, client den Plugin-Adapter (native-health.js), damit beides in Tests gefälscht werden kann.
export async function syncHealth({ client, store, now, force = false }) {
  const settings = await store.getSettings();
  const health = settings.health;
  if (!health?.connected) return 'skipped';
  if (!force && !shouldSync(health.lastAttemptAt, now)) return 'skipped';
  await store.saveSettings({ ...settings, health: { ...health, lastAttemptAt: now } });

  try {
    const range = syncWindow({ lastSyncAt: health.lastSyncAt ?? null, now });
    // Nur eingeschaltete Werte lesen.
    const raw = await client.readAll(range, hcTypesFor(enabledMetrics(settings)));
    // null = nicht gelesen (Fehler oder kein Recht). Klappt gar nichts, zählt es nicht als Abgleich: Der Erstabgleich wird wiederholt.
    const read = VITAL_TYPES.filter((t) => raw[t] != null);
    if (!read.length && raw.weights == null) return 'failed';
    const days = buildVitalsDays(raw, now);
    await store.putVitalsDays(mergeVitalsDays(await store.listVitals(), days, { read, from: dayKeyOf(range.start), to: dayKeyOf(range.end), now }));
    const weights = weightsToImport(raw.weights ?? [], await store.listWeights());
    if (weights.length) await store.putWeights(weights);

    let written = health.written ?? [];
    if (health.sendNutrition !== false) {
      const todayKey = localDateKey(new Date(now));
      const yesterday = addDays(todayKey, -1);
      const status = (await store.listDayStatuses()).find((d) => d.dateKey === yesterday)?.status ?? null;
      const target = dayToWrite({ todayKey, meals: await store.listMeals(), status, written });
      if (target) {
        await client.writeDay(target);
        written = [...written, target.dateKey].slice(-KEEP_WRITTEN);
      }
    }
    const fresh = await store.getSettings(); // Einstellungen können sich während des Abgleichs geändert haben
    await store.saveSettings({ ...fresh, health: { ...fresh.health, lastSyncAt: now, written } });
    return 'done';
  } catch {
    return 'failed';
  }
}
