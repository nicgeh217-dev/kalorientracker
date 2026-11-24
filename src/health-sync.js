import { buildVitalsDays, mergeVitalsDays, weightsToImport, syncWindow, shouldSync, dayKeyOf } from './vitals.js';
import { mealsToSend, changedSince, trimSent } from './health-send.js';
import { enabledMetrics, hcTypesFor } from './health-metrics.js';

// Ergebnis-Schlüssel von readAll, die in die Tageswerte gehen (Gewicht wird getrennt übernommen).
const VITAL_TYPES = ['steps', 'activeKcal', 'totalKcal', 'restingHr', 'sleep', 'workouts', 'distance', 'floors', 'hr', 'hrv', 'spo2', 'respRate', 'vo2max', 'bodyFat'];

// Abgleich mit Health Connect: Werte lesen, Gewichte übernehmen, den abgeschlossenen Vortag zurückschreiben.
// Wirft nie. Ergebnis: 'skipped' (nicht verbunden oder zu früh), 'done' oder 'failed' (still, der nächste Versuch holt es nach).
// store kapselt die Datenbank, client den Plugin-Adapter (native-health.js), damit beides in Tests gefälscht werden kann.
// sendNow: auch Mahlzeiten unter 3 Stunden senden (Knopf "Jetzt senden").
export async function syncHealth({ client, store, now, force = false, sendNow = false }) {
  const settings = await store.getSettings();
  const health = settings.health;
  if (!health?.connected) return 'skipped';
  if (!force && !shouldSync(health.lastAttemptAt, now)) return 'skipped';
  await store.saveSettings({ ...settings, health: { ...health, lastAttemptAt: now } });

  try {
    const range = syncWindow({ lastSyncAt: health.lastSyncAt ?? null, now });
    // Nur eingeschaltete Werte lesen. Sind alle aus, wird nichts gelesen, das Senden der Kalorien läuft trotzdem.
    const types = hcTypesFor(enabledMetrics(settings));
    const raw = types.length ? await client.readAll(range, types) : {};
    // null = nicht gelesen (Fehler oder kein Recht). Klappt gar nichts, zählt es nicht als Abgleich: Der Erstabgleich wird wiederholt.
    const read = VITAL_TYPES.filter((t) => raw[t] != null);
    if (types.length && !read.length && raw.weights == null) return 'failed';
    const days = buildVitalsDays(raw, now);
    await store.putVitalsDays(mergeVitalsDays(await store.listVitals(), days, { read, from: dayKeyOf(range.start), to: dayKeyOf(range.end), now }));
    const weights = weightsToImport(raw.weights ?? [], await store.listWeights());
    if (weights.length) await store.putWeights(weights);

    // Gegessenes senden: jede Mahlzeit einzeln, einmal. Ein Fehler wird gemerkt (lastSend), damit er in den Einstellungen sichtbar ist.
    let sentMeals = health.sentMeals;
    let lastSend = health.lastSend;
    if (health.sendNutrition !== false) {
      const meals = await store.listMeals();
      const todo = mealsToSend({ meals, now, sent: sentMeals ?? {}, days: await store.listDayStatuses(), writtenDays: health.written ?? [], immediately: sendNow });
      const done = {};
      let failed = false;
      for (const m of todo) {
        try {
          await client.writeMeal(m);
          done[m.key] = m.signature;
        } catch {
          failed = true;
          break; // fehlt das Recht, scheitern alle: nicht jede einzeln versuchen
        }
      }
      if (Object.keys(done).length) sentMeals = trimSent({ ...(sentMeals ?? {}), ...done });
      if (todo.length || failed) {
        lastSend = failed
          ? { at: now, ok: false, count: Object.keys(done).length, error: 'Recht fehlt oder Health Connect nicht erreichbar' }
          : { at: now, ok: true, count: Object.keys(done).length };
      }
      lastSend = { ...(lastSend ?? {}), changed: changedSince(meals, sentMeals ?? {}).length };
    }
    const fresh = await store.getSettings(); // Einstellungen können sich während des Abgleichs geändert haben
    // Wurde der Verlauf währenddessen zurückgesetzt (neue Rechte), bleibt er zurückgesetzt: Der nächste Abgleich lädt dann 90 Tage.
    const resetMeanwhile = health.lastSyncAt != null && fresh.health?.lastSyncAt === null;
    await store.saveSettings({ ...fresh, health: { ...fresh.health, lastSyncAt: resetMeanwhile ? null : now, ...(sentMeals ? { sentMeals } : {}), ...(lastSend ? { lastSend } : {}) } });
    return 'done';
  } catch {
    return 'failed';
  }
}
