import { el, openSheet, closeSheet } from '../dom.js';
import { scanLabel } from '../gemini.js';
import { getSettings } from '../db.js';
import { showView } from '../nav.js';
import { openMealForm } from './meal-form.js';

function showError(message, retry) {
  openSheet(
    el('h1', {}, 'Scan nicht möglich'),
    el('div', { class: 'note bad' }, message),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => { closeSheet(); openMealForm(null); } }, 'Manuell eintragen'),
      el('button', { class: 'primary', onClick: () => { closeSheet(); retry(); } }, 'Nochmal'),
      el('button', { class: 'btn wide', onClick: closeSheet }, 'Abbrechen')));
}

export async function startScan() {
  const { geminiKey, geminiModel } = await getSettings();
  if (!geminiKey) {
    openSheet(
      el('h1', {}, 'Gemini-Key fehlt'),
      el('div', { class: 'note warn' }, 'Für den Foto-Scan brauchst du einen Gemini-API-Key. Du trägst ihn einmal in den Einstellungen ein.'),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
        el('button', { class: 'primary', onClick: () => { closeSheet(); showView('settings'); } }, 'Zu den Einstellungen')));
    return;
  }

  const input = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    openSheet(el('h1', {}, 'Lese Etikett …'), el('div', { class: 'muted' }, 'Das dauert ein paar Sekunden.'));
    const result = await scanLabel(file, geminiKey, geminiModel || undefined);
    closeSheet();
    if (result.ok) openMealForm(result.label, `Erkannt mit ${result.model} in ${result.seconds.toFixed(1).replace('.', ',')} s`);
    else showError(result.error, startScan);
  });
  document.body.append(input);
  input.click();
}
