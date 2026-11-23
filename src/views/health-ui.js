import { el, toast } from '../dom.js';
import { refreshCurrent } from '../nav.js';
import {
  getSettings, saveSettings, listWeights, putWeights, putVitalsDays, listVitals, listMeals, listDayStatuses,
} from '../db.js';
import { healthClient } from '../native-health.js';
import { syncHealth } from '../health-sync.js';
import { METRICS, enabledMetrics, hcTypesFor } from '../health-metrics.js';

// Health Connect in der Android-App: Abgleich beim Start und bei der Rückkehr, dazu der Abschnitt in den Einstellungen.

const dbStore = { getSettings, saveSettings, listWeights, putWeights, putVitalsDays, listVitals, listMeals, listDayStatuses };

let running = null;
export function runHealthSync({ force = false } = {}) {
  // Läuft schon ein Abgleich (z. B. beim Zurückkehren aus Health Connect gestartet), wartet ein erzwungener auf ihn und läuft danach neu:
  // Sonst würde der alte Abgleich den zurückgesetzten Verlauf überschreiben und neue Werte bekämen nur 3 statt 90 Tage.
  if (running) return force ? running.then(() => runHealthSync({ force: true })) : running;
  running = syncHealth({ client: healthClient(), store: dbStore, now: Date.now(), force })
    .then((r) => { if (r === 'done') refreshCurrent(); return r; })
    .finally(() => { running = null; });
  return running;
}


const when = (ms) => new Date(ms).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function saveHealth(patch) {
  const s = await getSettings();
  await saveSettings({ ...s, health: { connected: false, sendNutrition: true, written: [], ...(s.health ?? {}), ...patch } });
}

// Abschnitt in den Einstellungen. Bleibt leer, wenn Health Connect nicht verfügbar ist (Browser, iPhone, sehr altes Android).
export function healthCard(s, rerender) {
  const box = el('div');
  const client = healthClient();
  client.available().then((ok) => { if (ok) box.replaceChildren(card(s, client, rerender)); });
  return box;
}

// Fehlt ein Recht für diesen Wert? Bei Kalorien genügt eines der beiden (aktiv oder gesamt).
const missingRight = (m, granted) => (m.id === 'kcal' ? !m.hc.some((t) => granted.includes(t)) : !m.hc.every((t) => granted.includes(t)));

// Rechte nur für bestimmte Typen anfragen und zu den bisherigen hinzufügen. Danach den Verlauf neu laden.
async function grant(client, types) {
  const r = await client.connect(types);
  const s = await getSettings();
  const before = s.health?.granted ?? { read: [], write: [] };
  const granted = { read: [...new Set([...before.read, ...r.read])], write: [...new Set([...(before.write ?? []), ...r.write])] };
  // Verlauf nur neu laden, wenn wirklich etwas freigegeben wurde.
  await saveHealth({ granted, ...(r.read.length ? { lastSyncAt: null } : {}) });
  return r.read.length > 0;
}

// Liste der Werte mit Schalter. Aus: nicht lesen, nicht zeigen. An ohne Recht: Health Connect fragt nur nach diesem Wert.
function metricList(s, client, rerender) {
  const granted = s.health?.granted?.read ?? [];
  const enabled = enabledMetrics(s);
  const missing = METRICS.filter((m) => enabled.includes(m.id) && missingRight(m, granted));
  const setEnabled = async (ids) => saveHealth({ metrics: METRICS.map((m) => m.id).filter((id) => ids.includes(id)) });

  const rows = METRICS.map((m) => {
    const box = el('input', { type: 'checkbox', checked: enabled.includes(m.id), 'aria-label': m.label });
    box.style.cssText = 'width:22px;min-height:22px;height:22px;flex:none';
    box.addEventListener('change', async () => {
      const ids = box.checked ? [...enabled, m.id] : enabled.filter((id) => id !== m.id);
      await setEnabled(ids);
      if (box.checked && missingRight(m, granted)) {
        try { await grant(client, m.hc); } catch { toast('Health Connect konnte nicht geöffnet werden.'); }
        runHealthSync({ force: true }).then(() => rerender());
      }
      rerender();
    });
    return el('label', { class: 'checkrow', style: 'margin:8px 4px' }, box,
      el('span', {}, m.label, enabled.includes(m.id) && missingRight(m, granted) ? el('span', { class: 'muted' }, ' · Recht fehlt') : null));
  });

  return el('div', {},
    el('h2', { style: 'margin:16px 0 4px' }, 'Werte'),
    el('div', { class: 'muted' }, 'Was du ausschaltest, wird nicht gelesen und nicht angezeigt.'),
    missing.length ? el('button', {
      class: 'primary', style: 'width:100%;margin-top:12px',
      onClick: async () => {
        try {
          if (await grant(client, hcTypesFor(missing.map((m) => m.id)))) {
            toast('Freigegeben. Die Werte werden geladen.');
            await runHealthSync({ force: true });
          }
        } catch { toast('Health Connect konnte nicht geöffnet werden.'); }
        rerender();
      },
    }, missing.length === 1 ? 'Neuen Wert freigeben' : 'Neue Werte freigeben') : null,
    ...rows);
}

function card(s, client, rerender) {
  const h = s.health ?? {};
  const msg = el('div');
  const hint = el('div', { class: 'muted', style: 'margin:4px 0 12px' },
    'In der Fitbit- bzw. Google-Health-App muss die Synchronisierung mit Health Connect eingeschaltet sein.');

  async function connect() {
    try {
      const granted = await client.connect();
      if (!granted.read.length) {
        msg.replaceChildren(el('div', { class: 'note warn' }, 'Es wurden keine Werte freigegeben. Du kannst es jederzeit erneut versuchen.'));
        return;
      }
      // Neue oder andere Rechte: den Verlauf von vorn laden, sonst fehlen die neu freigegebenen Werte für die letzten 90 Tage.
      const before = JSON.stringify((await getSettings()).health?.granted ?? null);
      await saveHealth({ connected: true, granted, ...(before !== JSON.stringify(granted) ? { lastSyncAt: null } : {}) });
      toast('Verbunden. Die Werte werden geladen.');
      rerender();
      const r = await runHealthSync({ force: true });
      if (r === 'failed') toast('Die Werte konnten noch nicht geladen werden. Die App versucht es beim nächsten Öffnen erneut.');
      rerender();
    } catch {
      msg.replaceChildren(el('div', { class: 'note bad' }, 'Health Connect konnte nicht geöffnet werden.'));
    }
  }

  if (!h.connected) {
    return el('div', { class: 'card' },
      el('h2', { style: 'margin:0 0 6px' }, 'Health Connect'),
      el('div', {}, 'Zeigt Schritte, verbrannte Kalorien, Ruhepuls, Schlaf, Gewicht und Fitbit-Trainings in der App. Alles bleibt auf dem Handy.'),
      hint,
      msg,
      el('button', { class: 'primary', style: 'width:100%', onClick: connect }, 'Verbinden'));
  }

  const send = el('input', { type: 'checkbox', checked: h.sendNutrition !== false });
  send.style.cssText = 'width:22px;min-height:22px;height:22px;flex:none';
  send.addEventListener('change', async () => { await saveHealth({ sendNutrition: send.checked }); });

  return el('div', { class: 'card' },
    el('h2', { style: 'margin:0 0 6px' }, 'Health Connect'),
    el('div', {}, 'Verbunden.'),
    el('div', { class: 'muted', style: 'margin-top:4px' }, h.lastSyncAt ? `Letzter Abgleich: ${when(h.lastSyncAt)}` : 'Noch kein Abgleich.'),
    hint,
    el('label', { class: 'checkrow' }, send, el('span', {}, 'Gegessene Kalorien und Protein an Health Connect senden (einmal pro abgeschlossenem Tag)')),
    metricList(s, client, rerender),
    msg,
    el('div', { class: 'actions' },
      el('button', {
        class: 'btn',
        onClick: async (ev) => {
          ev.currentTarget.disabled = true;
          const r = await runHealthSync({ force: true });
          toast(r === 'done' ? 'Abgeglichen.' : 'Der Abgleich hat nicht geklappt. Prüfe die Rechte in Health Connect.');
          rerender();
        },
      }, 'Jetzt abgleichen'),
      el('button', { class: 'btn', onClick: connect }, 'Rechte anfragen'),
      el('button', { class: 'btn', onClick: () => client.openSettings() }, 'Health Connect öffnen'),
      el('button', { class: 'btn', onClick: () => client.showPrivacy() }, 'Datenschutz'),
      el('button', {
        class: 'btn danger wide',
        onClick: async () => { await saveHealth({ connected: false }); toast('Getrennt. Gespeicherte Werte bleiben erhalten.'); rerender(); },
      }, 'Trennen')));
}
