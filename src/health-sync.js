import { localDateKey } from './logic.js';
import { addDays } from './overview.js';
import { buildVitalsDays, weightsToImport, dayToWrite, syncWindow, shouldSync } from './vitals.js';

const KEEP_WRITTEN = 14;

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
    const raw = await client.readAll(syncWindow({ lastSyncAt: health.lastSyncAt ?? null, now }));
    await store.putVitalsDays(buildVitalsDays(raw, now));
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
