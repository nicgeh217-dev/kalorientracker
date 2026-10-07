import { el, openSheet, closeSheet, toast } from '../dom.js';
import { analyzeFood, resizeImage, MAX_PHOTOS } from '../gemini.js';
import { getSettings, addQueued, deleteQueued } from '../db.js';
import { showView, refreshCurrent } from '../nav.js';
import { viewedDateKey } from '../state.js';
import { openMealForm } from './meal-form.js';

// state: { photos: [{file, url}], hint, queuedId?, dateKey? }
// Fotos und Text bleiben bei Fehlern und beim "Neu schätzen" erhalten.
function releasePhotos(state) {
  for (const p of state.photos) URL.revokeObjectURL(p.url);
  state.photos = [];
}

const RETRYABLE = new Set(['offline', 'network', 'overloaded']);

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

// Speichert Fotos (verkleinert) und Text für später. Wird in der "Wartet auf Auswertung"-Liste auf Heute angezeigt.
async function saveForLater(state) {
  try {
    const blobs = [];
    for (const p of state.photos) blobs.push(await resizeImage(p.file));
    await addQueued({ blobs, hint: state.hint.trim(), dateKey: state.dateKey ?? viewedDateKey(), createdAt: new Date().toISOString() });
  } catch {
    return toast('Speichern für später ist fehlgeschlagen (Speicher voll?).');
  }
  releasePhotos(state);
  closeSheet();
  toast('Gespeichert. Auswerten kannst du es online auf „Heute“ unter „Wartet auf Auswertung“.');
  refreshCurrent();
}

function showError(message, state, reason) {
  const canQueue = RETRYABLE.has(reason) && state.queuedId == null && (state.photos.length > 0 || state.hint.trim().length >= 3);
  openSheet(
    el('h1', {}, 'Auswertung nicht möglich'),
    el('div', { class: 'note bad' }, message),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => { releasePhotos(state); closeSheet(); openMealForm(null, { dateKey: state.dateKey }); } }, 'Manuell eintragen'),
      el('button', { class: 'primary', onClick: () => run(state) }, 'Nochmal'),
      canQueue ? el('button', { class: 'btn wide', onClick: () => saveForLater(state) }, 'Für später speichern (offline-fähig)') : null,
      el('button', { class: 'btn wide', onClick: () => { releasePhotos(state); closeSheet(); } }, 'Abbrechen')));
}

function openScanSheet(state) {
  const full = state.photos.length >= MAX_PHOTOS;
  const offline = navigator.onLine === false;
  const hasInput = () => state.photos.length > 0 || state.hint.trim().length >= 3;

  const hint = el('textarea', { rows: 2, placeholder: 'z. B. Döner mit Hähnchen, große Portion', value: state.hint });
  const runBtn = offline && state.queuedId == null
    ? el('button', { class: 'primary', disabled: !hasInput(), onClick: () => saveForLater(state) }, 'Für später speichern')
    : el('button', { class: 'primary', disabled: !hasInput(), onClick: () => run(state) }, 'Auswerten');
  hint.addEventListener('input', () => {
    state.hint = hint.value;
    runBtn.disabled = !hasInput();
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
    offline && state.queuedId == null
      ? el('div', { class: 'note warn' }, 'Du bist offline. Du kannst die Fotos jetzt speichern und später auswerten lassen.')
      : null,
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
    el('label', {}, 'Beschreibung / Hinweis (optional)'),
    hint,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => { releasePhotos(state); closeSheet(); } }, 'Abbrechen'),
      runBtn));
}

async function run(state) {
  const { geminiKey, geminiModel } = await getSettings();
  openSheet(el('h1', {}, 'Werte werden gelesen …'), el('div', { class: 'muted' }, 'Das dauert ein paar Sekunden.'));
  const result = await analyzeFood({ files: state.photos.map((p) => p.file), hint: state.hint }, geminiKey, geminiModel || undefined);
  if (!result.ok) return showError(result.error, state, result.reason);
  closeSheet();
  const l = result.label;
  const isEstimate = l.source === 'estimate';
  openMealForm(l, {
    info: `Ausgewertet mit ${result.model} in ${result.seconds.toFixed(1).replace('.', ',')} s`,
    estimate: isEstimate ? { confidence: l.confidence, note: l.note, kcalMin: l.kcalMin, kcalMax: l.kcalMax } : null,
    dateKey: state.dateKey,
    // Fotos bleiben im Speicher, solange das Formular offen ist, damit "Neu schätzen" sie wiederverwenden kann.
    onRefine: isEstimate ? () => openScanSheet(state) : null,
    onSaved: async () => {
      if (state.queuedId != null) await deleteQueued(state.queuedId);
      releasePhotos(state);
      refreshCurrent();
    },
    onCancel: () => releasePhotos(state),
  });
}

// Ein in der Warteschlange gespeicherter Eintrag wird ausgewertet (online). Erst nach dem Speichern der Mahlzeit verschwindet er.
export function runQueued(item) {
  const photos = item.blobs.map((blob) => ({ file: blob, url: URL.createObjectURL(blob) }));
  return run({ photos, hint: item.hint ?? '', queuedId: item.id, dateKey: item.dateKey });
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
