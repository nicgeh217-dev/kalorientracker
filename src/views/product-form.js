import { el, openSheet, closeSheet, parseNum, segmented, toast } from '../dom.js';
import { updateProduct, deleteProduct, restoreProduct, listProducts } from '../db.js';
import { normalizeBarcode, findProductByBarcode } from '../barcode.js';
import { isNativeApp } from '../native-camera.js';
import { scanBarcode } from '../native-scanner.js';
import { refreshCurrent } from '../nav.js';

const EXTRA_FIELDS = [['fiber', 'Ballaststoffe (g)'], ['sugar', 'Zucker (g)']];
const FIELDS = [['kcal', 'Kalorien (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Kohlenhydrate (g)'], ['fat', 'Fett (g)']];

// Produkt umbenennen, Werte korrigieren oder löschen. Bereits gespeicherte Mahlzeiten bleiben unverändert.
export function openProductForm(p) {
  const val = (v) => (v == null ? '' : String(v));
  const name = el('input', { value: p.name });
  const basis = el('select', {},
    el('option', { value: 'perServing', selected: p.basis !== 'per100g', 'data-short': 'Pro Portion' }, 'pro Portion'),
    el('option', { value: 'per100g', selected: p.basis === 'per100g', 'data-short': 'Pro 100 g' }, 'pro 100 g'));
  const serving = el('input', { inputMode: 'decimal', value: val(p.servingGrams), placeholder: 'Gramm pro Portion (optional)' });
  const inputs = Object.fromEntries([...FIELDS, ...EXTRA_FIELDS].map(([k]) => [k, el('input', { inputMode: 'decimal', value: val(p[k]) })]));
  const barcode = el('input', { inputMode: 'numeric', value: p.barcode ?? '', placeholder: 'z. B. 8801073210080', 'aria-label': 'Strichcode' });
  const scanBtn = isNativeApp() ? el('button', { type: 'button', class: 'small ghost', onClick: async () => {
    try {
      const raw = await scanBarcode({ onInstalling: () => toast('Der Scanner wird einmalig geladen.') });
      if (raw == null) return;
      const code = normalizeBarcode(raw);
      if (!code) return toast('Dieser Strichcode wurde nicht sicher erkannt. Versuche es noch einmal.');
      barcode.value = code;
    } catch (e) { toast(e?.message || 'Der Scanner konnte nicht geöffnet werden.'); }
  } }, 'Scannen') : null;
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
      fiber: parseNum(inputs.fiber.value),
      sugar: parseNum(inputs.sugar.value),
    };
    const typed = barcode.value.trim();
    if (typed) {
      const code = normalizeBarcode(typed);
      if (!code) return msg.replaceChildren(el('div', { class: 'note bad' }, 'Der Strichcode ist ungültig (Länge oder Prüfziffer stimmt nicht). Scanne ihn oder tippe alle Ziffern ab.'));
      const other = findProductByBarcode((await listProducts()).filter((x) => x.id !== p.id), code);
      if (other) return msg.replaceChildren(el('div', { class: 'note bad' }, `Dieser Strichcode gehört schon zu „${other.name}“.`));
      next.barcode = code;
    } else {
      delete next.barcode;
    }
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
    try {
      await deleteProduct(p.id);
      closeSheet();
      refreshCurrent();
      toast(`${p.name} gelöscht. Eingetragene Mahlzeiten bleiben erhalten.`, 'Rückgängig', async () => { await restoreProduct(p); refreshCurrent(); });
    } catch {
      msg.replaceChildren(el('div', { class: 'note bad' }, 'Löschen fehlgeschlagen. Bitte erneut versuchen.'));
    }
  }

  openSheet(
    el('h1', {}, 'Produkt bearbeiten'),
    el('label', {}, 'Name'), name,
    el('label', {}, 'Nährwerte gelten'), segmented(basis),
    el('label', {}, 'Gramm pro Portion (optional)'), serving,
    el('div', { class: 'grid2' }, ...[...FIELDS, ...EXTRA_FIELDS].map(([k, label]) => el('div', {}, el('label', {}, label), inputs[k]))),
    el('label', {}, 'Strichcode (optional)'),
    el('div', { class: 'row' }, barcode, scanBtn),
    msg,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
      el('button', { class: 'primary', onClick: save }, 'Speichern'),
      el('button', { class: 'btn danger wide', onClick: remove }, 'Produkt löschen')));
}
