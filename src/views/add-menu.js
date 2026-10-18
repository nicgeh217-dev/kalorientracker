import { el, openSheet, closeSheet } from '../dom.js';
import { startScanWithPicker, startDescribe } from './scan.js';
import { openMealForm } from './meal-form.js';
import { showView } from '../nav.js';

// Ein Einstiegspunkt für alles: der Kamera-Button in der Leiste öffnet diese Auswahl.
export function openAddMenu() {
  const item = (title, sub, run, primary = false) => el('button', {
    class: `menu-item${primary ? ' primary-item' : ''}`,
    onClick: () => { closeSheet(); run(); },
  }, el('b', {}, title), el('span', {}, sub));

  openSheet(
    el('h1', {}, 'Eintragen'),
    el('div', { class: 'menu' },
      item('Foto aufnehmen', 'Nährwerttabelle oder Essen', () => startScanWithPicker({ camera: true }), true),
      item('Aus Galerie', 'Ein oder mehrere Fotos', () => startScanWithPicker({ camera: false })),
      item('Beschreiben', 'z. B. „Döner mit Hähnchen“', () => startDescribe()),
      item('Aus Produkten', 'Bereits gespeicherte Produkte', () => showView('products')),
      item('Manuell', 'Werte selbst eintragen', () => openMealForm(null))),
    el('div', { class: 'actions' }, el('button', { class: 'btn wide', onClick: closeSheet }, 'Abbrechen')));
}
