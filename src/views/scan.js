import { el, openSheet, closeSheet } from '../dom.js';
import { analyzeFood, MAX_PHOTOS } from '../gemini.js';
import { getSettings } from '../db.js';
import { showView } from '../nav.js';
import { openMealForm } from './meal-form.js';

// state: { photos: [{file, url}], hint: string } – bleibt bei Fehlern erhalten ("Nochmal" ohne alles neu zu machen).
function releasePhotos(state) {
  for (const p of state.photos) URL.revokeObjectURL(p.url);
  state.photos = [];
}

function pickFiles({ camera }, onFiles) {
  const input = el('input', { type: 'file', accept: 'image/*', hidden: true, multiple: !camera });
  if (camera) input.setAttribute('capture', 'environment');
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.remove();
    if (files.length) onFiles(files);
  });
  document.body.append(input);
  input.click();
}

function showError(message, state) {
  openSheet(
    el('h1', {}, 'Auswertung nicht möglich'),
    el('div', { class: 'note bad' }, message),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => { releasePhotos(state); closeSheet(); openMealForm(null); } }, 'Manuell eintragen'),
      el('button', { class: 'primary', onClick: () => openScanSheet(state) }, 'Nochmal'),
      el('button', { class: 'btn wide', onClick: () => { releasePhotos(state); closeSheet(); } }, 'Abbrechen')));
}

function openScanSheet(state) {
  const full = state.photos.length >= MAX_PHOTOS;
  const canRun = state.photos.length > 0 || state.hint.trim().length >= 3;

  const hint = el('textarea', { rows: 2, placeholder: 'z. B. Döner mit Hähnchen, große Portion', value: state.hint });
  const runBtn = el('button', { class: 'primary', disabled: !canRun, onClick: () => run(state) }, 'Auswerten');
  hint.addEventListener('input', () => {
    state.hint = hint.value;
    runBtn.disabled = !(state.photos.length > 0 || state.hint.trim().length >= 3);
  });

  const add = (files) => {
    for (const file of files) {
      if (state.photos.length >= MAX_PHOTOS) break;
      state.photos.push({ file, url: URL.createObjectURL(file) });
    }
    openScanSheet(state);
  };

  openSheet(
    el('h1', {}, 'Essen erfassen'),
    el('div', { class: 'muted', style: 'margin:-8px 4px 12px' },
      'Fotografiere die Nährwerttabelle. Gibt es keine (Restaurant, Bäcker), fotografiere das Essen. Dann schätzt die KI. Mehrere Fotos desselben Produkts sind möglich.'),
    state.photos.length
      ? el('div', { class: 'thumbs' }, ...state.photos.map((p, i) => el('div', { class: 'thumb' },
          el('img', { src: p.url, alt: `Foto ${i + 1}` }),
          el('button', {
            'aria-label': `Foto ${i + 1} entfernen`,
            onClick: () => { URL.revokeObjectURL(p.url); state.photos.splice(i, 1); openScanSheet(state); },
          }, '×'))))
      : null,
    el('div', { class: 'actions', style: 'margin-top:0' },
      el('button', { class: 'btn', disabled: full, onClick: () => pickFiles({ camera: true }, add) }, state.photos.length ? '+ Weiteres Foto' : 'Foto aufnehmen'),
      el('button', { class: 'btn', disabled: full, onClick: () => pickFiles({ camera: false }, add) }, 'Aus Galerie')),
    full ? el('div', { class: 'muted', style: 'margin:0 4px' }, `Maximal ${MAX_PHOTOS} Fotos.`) : null,
    el('label', {}, 'Beschreibung (optional)'),
    hint,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => { releasePhotos(state); closeSheet(); } }, 'Abbrechen'),
      runBtn));
}

async function run(state) {
  const { geminiKey, geminiModel } = await getSettings();
  openSheet(el('h1', {}, 'Werte werden gelesen …'), el('div', { class: 'muted' }, 'Das dauert ein paar Sekunden.'));
  const result = await analyzeFood({ files: state.photos.map((p) => p.file), hint: state.hint }, geminiKey, geminiModel || undefined);
  if (!result.ok) return showError(result.error, state);
  releasePhotos(state);
  closeSheet();
  const l = result.label;
  openMealForm(l, {
    info: `Ausgewertet mit ${result.model} in ${result.seconds.toFixed(1).replace('.', ',')} s`,
    estimate: l.source === 'estimate' ? { confidence: l.confidence, note: l.note, kcalMin: l.kcalMin, kcalMax: l.kcalMax } : null,
  });
}

export async function startScan() {
  const { geminiKey } = await getSettings();
  if (!geminiKey) {
    openSheet(
      el('h1', {}, 'Gemini-Key fehlt'),
      el('div', { class: 'note warn' }, 'Für den Foto-Scan brauchst du einen Gemini-API-Key. Du trägst ihn einmal in den Einstellungen ein.'),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
        el('button', { class: 'primary', onClick: () => { closeSheet(); showView('settings'); } }, 'Zu den Einstellungen')));
    return;
  }
  openScanSheet({ photos: [], hint: '' });
}
