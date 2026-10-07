import { el, openSheet, closeSheet, parseNum, segmented } from '../dom.js';
import { updateProduct, deleteProduct } from '../db.js';
import { refreshCurrent } from '../nav.js';

const FIELDS = [['kcal', 'Kalorien (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Kohlenhydrate (g)'], ['fat', 'Fett (g)']];

// Produkt umbenennen, Werte korrigieren oder löschen. Bereits gespeicherte Mahlzeiten bleiben unverändert.
export function openProductForm(p) {
  const val = (v) => (v == null ? '' : String(v));
  const name = el('input', { value: p.name });
  const basis = el('select', {},
    el('option', { value: 'perServing', selected: p.basis !== 'per100g', 'data-short': 'Pro Portion' }, 'pro Portion'),
    el('option', { value: 'per100g', selected: p.basis === 'per100g', 'data-short': 'Pro 100 g' }, 'pro 100 g'));
  const serving = el('input', { inputMode: 'decimal', value: val(p.servingGrams), placeholder: 'Gramm pro Portion (optional)' });
  const inputs = Object.fromEntries(FIELDS.map(([k]) => [k, el('input', { inputMode: 'decimal', value: val(p[k]) })]));
  const msg = el('div');

  async function save() {
    const next = {
      ...p,
      name: name.value.trim(),
      basis: basis.value,
      servingGrams: parseNum(serving.value),
      kcal: parseNum(inputs.kcal.value),
      protein: parseNum(inputs.protein.value),
      carbs: parseNum(inputs.carbs.value),
      fat: parseNum(inputs.fat.value),
    };
    if (!next.name) return msg.replaceChildren(el('div', { class: 'note bad' }, 'Bitte einen Namen eingeben.'));
    if (next.kcal == null) return msg.replaceChildren(el('div', { class: 'note bad' }, 'Kalorien fehlen oder sind ungültig.'));
    try {
      await updateProduct(next);
      closeSheet();
      refreshCurrent();
    } catch {
      msg.replaceChildren(el('div', { class: 'note bad' }, 'Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    }
  }

  async function remove() {
    if (!confirm(`"${p.name}" aus der Produktliste löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.`)) return;
    try {
      await deleteProduct(p.id);
      closeSheet();
      refreshCurrent();
    } catch {
      msg.replaceChildren(el('div', { class: 'note bad' }, 'Löschen fehlgeschlagen. Bitte erneut versuchen.'));
    }
  }

  openSheet(
    el('h1', {}, 'Produkt bearbeiten'),
    el('label', {}, 'Name'), name,
    el('label', {}, 'Nährwerte gelten'), segmented(basis),
    el('label', {}, 'Gramm pro Portion (optional)'), serving,
    el('div', { class: 'grid2' }, ...FIELDS.map(([k, label]) => el('div', {}, el('label', {}, label), inputs[k]))),
    msg,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
      el('button', { class: 'primary', onClick: save }, 'Speichern'),
      el('button', { class: 'btn danger wide', onClick: remove }, 'Produkt löschen')));
}
