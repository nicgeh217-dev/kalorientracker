import { el, openSheet, closeSheet } from '../dom.js';
import { startScanWithPicker, startDescribe } from './scan.js';
import { openMealForm } from './meal-form.js';
import { showView } from '../nav.js';
import { openWorkout } from './workout.js';
import { isNativeApp } from '../native-camera.js';
import { startBarcodeScan } from './barcode-flow.js';

// Linien-Symbole (24er Raster), gleiche Strichstärke für alle.
const ICONS = {
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  barcode: 'M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14',
  gallery: 'M4 5h16v14H4z M4 15l4-4 4 4 3-3 5 5 M15.5 9.5a1 1 0 1 0 0-.01',
  text: 'M5 6h14M5 11h14M5 16h9',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4z M4 8l8 4 8-4 M12 12v8',
  pencil: 'M5 19l1-4L16 5l3 3L9 18z M14 7l3 3',
  scale: 'M5 20h14l-2-12H7z M9 8a3 3 0 0 1 6 0 M12 14l2-3',
  dumbbell: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
};

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name]);
  svg.append(p);
  return svg;
}

// Ein Einstiegspunkt für alles: der Plus-Knopf öffnet diese Auswahl. Foto groß oben, der Rest als Raster.
export function openAddMenu() {
  const tile = (name, title, sub, run, main = false) => el('button', {
    type: 'button', class: `addtile${main ? ' main' : ''}${main === 'full' ? ' full' : ''}`,
    onClick: () => { closeSheet(); run(); },
  }, el('span', { class: 'aticon' }, icon(name)), el('b', {}, title), sub ? el('span', { class: 'atsub' }, sub) : null);

  openSheet(
    el('h1', {}, 'Eintragen'),
    el('div', { class: 'addgrid' },
      tile('camera', 'Foto aufnehmen', 'Essen oder Nährwerttabelle', () => startScanWithPicker({ camera: true }), isNativeApp() ? true : 'full'),
      isNativeApp() ? tile('barcode', 'Strichcode', 'Produkt sofort finden', () => startBarcodeScan(), true) : null,
      tile('gallery', 'Aus Galerie', null, () => startScanWithPicker({ camera: false })),
      tile('text', 'Beschreiben', null, () => startDescribe()),
      tile('box', 'Produkte', null, () => showView('products')),
      tile('pencil', 'Manuell', null, () => openMealForm(null)),
      tile('scale', 'Gewicht', null, async () => {
        await showView('weight');
        document.querySelector('#view-weight input[inputmode="decimal"]')?.focus();
      }),
      tile('dumbbell', 'Training', null, () => openWorkout({}))),
    el('div', { class: 'actions' }, el('button', { class: 'btn wide', onClick: closeSheet }, 'Abbrechen')));
}
