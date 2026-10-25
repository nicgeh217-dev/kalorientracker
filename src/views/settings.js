import { el, mount } from '../dom.js';
import { showView } from '../nav.js';
import { persistenceStatus } from '../storage-persist.js';
import { MODELS, DEFAULT_MODEL } from '../gemini.js';
import { getSettings, saveSettings, exportAll, replaceAll } from '../db.js';
import { restoreFromText } from '../backup-import.js';
import { shareBackup, downloadBackup } from '../backup-share.js';
import { localDateKey } from '../logic.js';
import { parseIntGoal } from '../goals.js';
import { NUTRIENTS, nutrientTargets } from '../nutrients.js';
import { parseWeight } from '../weight-input.js';
import { minHealthyWeight } from '../calorie.js';
import { openCalculator } from './calculator.js';
import { onlineBackupCard } from './online-backup-ui.js';

export async function renderSettings() {
  const root = document.getElementById('view-settings');
  const s = await getSettings();
  const persisted = await persistenceStatus();
  const msg = el('div');
  const say = (text, kind = 'warn') => msg.replaceChildren(el('div', { class: `note ${kind}` }, text));

  const goal = el('input', { inputMode: 'numeric', placeholder: 'z. B. 2200', value: s.calorieGoal ?? '' });
  const petOn = el('input', { type: 'checkbox', checked: s.pet?.enabled !== false });
  petOn.style.cssText = 'width:22px;min-height:22px;height:22px;flex:none';
  const proteinGoal = el('input', { inputMode: 'numeric', placeholder: 'optional, z. B. 120', value: s.proteinGoal ?? '' });
  const targetWeight = el('input', { inputMode: 'decimal', placeholder: 'optional, z. B. 68,5', value: s.targetWeight == null ? '' : String(s.targetWeight).replace('.', ',') });
  const defaults = nutrientTargets({ kcal: s.calorieGoal, proteinGoal: s.proteinGoal });
  const targetInputs = Object.fromEntries(NUTRIENTS.map((n) => [n.id, el('input', {
    inputMode: 'numeric', 'aria-label': `${n.label} (g)`, value: s.targets?.[n.id] ?? '',
    placeholder: defaults ? String(defaults[n.id]) : 'Standard',
  })]));
  const key = el('input', { type: 'password', placeholder: 'AIza …', value: s.geminiKey ?? '', autocomplete: 'off' });
  const known = MODELS.some((m) => m.id === s.geminiModel);
  const model = el('select', {},
    ...MODELS.map((m) => el('option', { value: m.id, selected: (s.geminiModel || DEFAULT_MODEL) === m.id }, m.label)),
    el('option', { value: '__custom', selected: Boolean(s.geminiModel) && !known }, 'Eigene Modell-ID …'));
  const custom = el('input', { placeholder: 'z. B. gemini-3.8-flash', value: !known ? (s.geminiModel ?? '') : '' });
  const syncCustom = () => { custom.hidden = model.value !== '__custom'; };
  model.addEventListener('change', syncCustom);
  syncCustom();

  const toggle = el('button', {
    class: 'small ghost',
    onClick: () => {
      key.type = key.type === 'password' ? 'text' : 'password';
      toggle.textContent = key.type === 'password' ? 'Anzeigen' : 'Verbergen';
    },
  }, 'Anzeigen');

  const save = el('button', {
    class: 'primary',
    onClick: async () => {
      const g = parseIntGoal(goal.value, { max: 9999 });
      if (!g.ok) return say('Das Kalorienziel muss eine ganze Zahl zwischen 1 und 9999 sein.', 'bad');
      const pg = parseIntGoal(proteinGoal.value, { max: 500 });
      if (!pg.ok) return say('Das Proteinziel muss eine ganze Zahl zwischen 1 und 500 g sein (oder leer).', 'bad');
      const tw = targetWeight.value.trim() === '' ? null : parseWeight(targetWeight.value);
      if (targetWeight.value.trim() !== '' && tw == null) return say('Das Zielgewicht muss zwischen 20 und 400 kg liegen, z. B. 68,5 (oder leer).', 'bad');
      const minW = s.calcProfile?.heightCm ? minHealthyWeight(s.calcProfile.heightCm) : null;
      if (tw != null && minW != null && tw < minW) return say(`Ein Zielgewicht unter ${String(minW).replace('.', ',')} kg entspräche einem BMI unter 18,5 (Untergewicht). Bitte wähle ein höheres Ziel.`, 'bad');
      const targets = {};
      for (const n of NUTRIENTS) {
        const r = parseIntGoal(targetInputs[n.id].value, { max: 999 });
        if (!r.ok) return say(`${n.label}: bitte eine ganze Zahl zwischen 1 und 999 g eintragen (oder leer lassen).`, 'bad');
        if (r.value != null) targets[n.id] = r.value;
      }
      const chosen = model.value === '__custom' ? custom.value.trim() : model.value;
      if (model.value === '__custom' && !/^[A-Za-z0-9._-]+$/.test(chosen)) {
        return say('Bitte eine gültige Modell-ID eintragen (nur Buchstaben, Zahlen, Punkt, Bindestrich).', 'bad');
      }
      const fresh = await getSettings();
      const manualChange = fresh.calcProfile && g.value !== fresh.calorieGoal; // eigenes Ziel eingetippt: keine Rechner-Vorschläge mehr
      const petPatch = fresh.pet || !petOn.checked ? { pet: { name: 'Foxi', seenLevel: 0, ...(fresh.pet ?? {}), enabled: petOn.checked } } : {};
      await saveSettings({ ...fresh, ...petPatch, autoGoal: manualChange ? false : fresh.autoGoal, calorieGoal: g.value, proteinGoal: pg.value, targetWeight: tw, targets: Object.keys(targets).length ? targets : undefined, geminiKey: key.value.trim() || null, geminiModel: chosen || null });
      say('Gespeichert.', 'warn');
    },
  }, 'Speichern');

  const shareBtn = el('button', {
    class: 'btn',
    onClick: async () => {
      const r = await shareBackup();
      if (r !== 'cancelled') { say(r === 'shared' ? 'Sicherung geteilt.' : 'Sicherung heruntergeladen.', 'warn'); renderSettings(); }
    },
  }, 'Sicherung teilen');
  const exportBtn = el('button', { class: 'btn', onClick: async () => { await downloadBackup(); renderSettings(); } }, 'Als Datei speichern');

  const importInput = el('input', { type: 'file', accept: 'application/json,.json,text/plain', hidden: true });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    const text = await file.text();
    if (!confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) return;
    const r = await restoreFromText(text, replaceAll);
    if (!r.ok) return say(r.error, 'bad');
    say(`Sicherung wiederhergestellt: ${r.counts.meals} Mahlzeiten, ${r.counts.products} Produkte, ${r.counts.weights} Gewichtseinträge.`, 'warn');
    renderSettings();
  });

  mount(root,
    el('div', { class: 'eyebrow' }, 'Persönlich'),
    el('h1', {}, 'Einstellungen'),
    el('div', { class: 'card' },
      el('label', {}, 'Tägliches Kalorienziel (kcal)'), goal,
      el('button', { class: 'btn', style: 'width:100%;margin-top:8px', onClick: openCalculator }, 'Kalorienrechner öffnen'),
      calcInfo(s),
      el('label', {}, 'Tägliches Proteinziel (g, optional)'), proteinGoal,
      el('label', {}, 'Zielgewicht (kg, optional)'), targetWeight,
      el('label', {}, 'Nährstoff-Richtwerte in g (optional)'),
      el('div', { class: 'grid2' }, ...NUTRIENTS.map((n) => el('div', {}, el('label', {}, n.label), targetInputs[n.id]))),
      el('div', { class: 'muted', style: 'margin:6px 4px 0' }, 'Nur Orientierungswerte, keine Vorgabe. Leer lassen = Standard (grob aus deinem Kalorienziel berechnet).'),
      el('label', {}, 'Gemini-API-Key (nur auf diesem Handy gespeichert)'),
      el('div', { class: 'row' }, key, toggle),
      el('label', {}, 'Gemini-Modell'), model, custom,
      el('div', { class: 'muted', style: 'margin:6px 4px 0' }, 'Schnell = kürzere Wartezeit, Genau = liest kleine koreanische Schrift zuverlässiger. Nach jedem Scan siehst du Modell und Dauer.'),
      msg,
      el('div', { class: 'actions' }, el('div', { class: 'wide', style: 'display:grid' }, save))),
    el('div', { class: 'card' },
      el('label', { class: 'checkrow', style: 'margin:0' }, petOn, el('span', {}, 'Fuchs-Begleiter anzeigen (erinnert freundlich ans Tracken, bewertet nie dein Essen)')),
      el('div', { class: 'muted', style: 'margin:6px 4px 0' }, 'Wird mit „Speichern“ oben übernommen.')),
    el('div', { class: 'card' },
      el('button', { class: 'btn', style: 'width:100%', onClick: () => showView('products') }, 'Gespeicherte Produkte verwalten')),
    el('div', { class: 'card', id: 'backup-card' },
      el('h2', { style: 'margin:0 0 6px' }, 'Sicherung'),
      el('div', { class: 'muted' }, 'Sichert Mahlzeiten, Produkte, Gewicht und Ziele (ohne Gemini-Key). „Sicherung teilen“ öffnet das Teilen-Menü deines Handys, z. B. Google Drive. Beim Import werden alle aktuellen Daten ersetzt.'),
      el('div', { class: 'muted', style: 'margin-top:8px' }, lastBackupText(s.lastBackupAt)),
      el('div', { class: 'muted', style: 'margin-top:8px' }, persistText(persisted)),
      el('div', { class: 'actions' },
        shareBtn,
        exportBtn,
        el('button', { class: 'btn', onClick: () => importInput.click() }, 'Sicherung importieren'),
        importInput)),
    onlineBackupCard(s, renderSettings));
}

function calcInfo(s) {
  const p = s.calcProfile;
  if (!p) return el('div', { class: 'muted', style: 'margin:6px 4px 0' }, 'Eigenes Ziel eintippen oder den Rechner aus Geschlecht, Alter, Größe, Gewicht und Aktivität nutzen.');
  const when = new Date(p.calcDate + 'T00:00:00').toLocaleDateString('de-DE');
  return el('div', { class: 'muted', style: 'margin:6px 4px 0' }, s.autoGoal
    ? `Berechnet am ${when} bei ${String(p.calcWeightKg).replace('.', ',')} kg. Wenn sich dein Gewicht ändert, schlägt die App ein neues Ziel vor.`
    : `Eigenes Ziel (Rechner vom ${when}). Es gibt keine automatischen Vorschläge. Im Rechner kannst du sie wieder einschalten.`);
}

function lastBackupText(iso) {
  if (!iso) return 'Letzte Sicherung: noch nie.';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  const when = days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
  return `Letzte Sicherung: ${when} (${new Date(iso).toLocaleDateString('de-DE')}).`;
}

function persistText(status) {
  const state = { granted: 'ja', 'not-granted': 'nein', unsupported: 'unbekannt' }[status];
  return `Speicher geschützt: ${state}. Lösche in Chrome nicht „Cookies und Websitedaten“ für diese Seite, sonst gehen die Daten verloren. Mach regelmäßig eine Sicherung.`;
}
