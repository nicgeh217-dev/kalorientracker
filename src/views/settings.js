import { el } from '../dom.js';
import { getSettings, saveSettings, exportAll, replaceAll } from '../db.js';
import { buildBackup, parseBackup } from '../backup.js';
import { localDateKey } from '../logic.js';

export async function renderSettings() {
  const root = document.getElementById('view-settings');
  const s = await getSettings();
  const msg = el('div');
  const say = (text, kind = 'warn') => msg.replaceChildren(el('div', { class: `note ${kind}` }, text));

  const goal = el('input', { inputMode: 'numeric', placeholder: 'z. B. 2200', value: s.calorieGoal ?? '' });
  const key = el('input', { type: 'password', placeholder: 'AIza …', value: s.geminiKey ?? '', autocomplete: 'off' });
  const toggle = el('button', {
    class: 'small',
    onClick: () => {
      key.type = key.type === 'password' ? 'text' : 'password';
      toggle.textContent = key.type === 'password' ? 'Anzeigen' : 'Verbergen';
    },
  }, 'Anzeigen');

  const save = el('button', {
    class: 'primary',
    onClick: async () => {
      const raw = goal.value.trim();
      const g = raw === '' ? null : Number(raw);
      if (g !== null && !(Number.isInteger(g) && g > 0 && g < 10000)) {
        return say('Das Kalorienziel muss eine ganze Zahl zwischen 1 und 9999 sein.', 'bad');
      }
      await saveSettings({ ...(await getSettings()), calorieGoal: g, geminiKey: key.value.trim() || null });
      say('Gespeichert.', 'warn');
    },
  }, 'Speichern');

  const exportBtn = el('button', {
    onClick: async () => {
      const backup = buildBackup(await exportAll(), new Date());
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const a = el('a', { href: url, download: `kalorientracker-${localDateKey(new Date())}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
  }, 'Sicherung exportieren');

  const importInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) return say(parsed.error, 'bad');
    const d = parsed.data;
    if (!confirm(`Alle aktuellen Daten ersetzen durch ${d.meals.length} Mahlzeiten, ${d.products.length} Produkte und ${d.weights.length} Gewichtseinträge?`)) return;
    try {
      await replaceAll(d);
      say('Sicherung wiederhergestellt.', 'warn');
      renderSettings();
    } catch {
      say('Der Import ist fehlgeschlagen. Deine bisherigen Daten sind unverändert.', 'bad');
    }
  });

  root.replaceChildren(
    el('h1', {}, 'Einstellungen'),
    el('div', { class: 'card' },
      el('label', {}, 'Tägliches Kalorienziel (kcal)'), goal,
      el('label', {}, 'Gemini-API-Key (nur auf diesem Handy gespeichert)'),
      el('div', { class: 'row' }, key, toggle),
      msg,
      el('div', { class: 'actions' }, save)),
    el('div', { class: 'card' },
      el('h2', { style: 'margin-top:0' }, 'Sicherung'),
      el('div', { class: 'muted' }, 'Exportiert Mahlzeiten, Produkte, Gewicht und Ziel (ohne Gemini-Key). Beim Import werden alle aktuellen Daten ersetzt.'),
      el('div', { class: 'actions' },
        exportBtn,
        el('button', { onClick: () => importInput.click() }, 'Sicherung importieren'),
        importInput)));
}
