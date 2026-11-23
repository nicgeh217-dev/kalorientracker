import { el, toast } from '../dom.js';
import { refreshCurrent } from '../nav.js';
import {
  getSettings, saveSettings, listWeights, putWeights, putVitalsDays, listVitals, listMeals, listDayStatuses,
} from '../db.js';
import { healthClient } from '../native-health.js';
import { syncHealth } from '../health-sync.js';

// Health Connect in der Android-App: Abgleich beim Start und bei der Rückkehr, dazu der Abschnitt in den Einstellungen.

const dbStore = { getSettings, saveSettings, listWeights, putWeights, putVitalsDays, listVitals, listMeals, listDayStatuses };

let running = null;
export function runHealthSync({ force = false } = {}) {
  if (running) return running;
  running = syncHealth({ client: healthClient(), store: dbStore, now: Date.now(), force })
    .then((r) => { if (r === 'done') refreshCurrent(); return r; })
    .finally(() => { running = null; });
  return running;
}

const LABELS = {
  steps: 'Schritte', calories: 'aktive Kalorien', totalCalories: 'Kalorien gesamt', restingHeartRate: 'Ruhepuls',
  sleep: 'Schlaf', weight: 'Gewicht', workouts: 'Trainings',
};

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
  const read = (h.granted?.read ?? []).map((t) => LABELS[t]).filter(Boolean);

  return el('div', { class: 'card' },
    el('h2', { style: 'margin:0 0 6px' }, 'Health Connect'),
    el('div', {}, read.length ? `Verbunden. Freigegeben: ${read.join(', ')}.` : 'Verbunden.'),
    el('div', { class: 'muted', style: 'margin-top:4px' }, h.lastSyncAt ? `Letzter Abgleich: ${when(h.lastSyncAt)}` : 'Noch kein Abgleich.'),
    hint,
    el('label', { class: 'checkrow' }, send, el('span', {}, 'Gegessene Kalorien und Protein an Health Connect senden (einmal pro abgeschlossenem Tag)')),
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
