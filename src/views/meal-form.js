import { el, openSheet, closeSheet, parseNum } from '../dom.js';
import { scaleNutrition, checkPlausibility, localDateKey } from '../logic.js';
import { addProduct, addMeal } from '../db.js';
import { refreshCurrent } from '../nav.js';

const FIELDS = [['kcal', 'Kalorien (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Kohlenhydrate (g)'], ['fat', 'Fett (g)']];

// prefill: {name, basis, servingGrams, kcal, protein, carbs, fat, productId?} oder null
export function openMealForm(prefill) {
  const p = prefill ?? {};
  const val = (v) => (v == null ? '' : String(v));
  const inputs = {};
  let issuesShown = false;

  const name = el('input', { value: val(p.name), placeholder: 'z. B. Triangle Kimbap Thunfisch' });
  const basis = el('select', {},
    el('option', { value: 'perServing', selected: p.basis !== 'per100g' }, 'Werte gelten pro Portion / Packung'),
    el('option', { value: 'per100g', selected: p.basis === 'per100g' }, 'Werte gelten pro 100 g'));
  const serving = el('input', { inputMode: 'decimal', value: val(p.servingGrams), placeholder: 'Gramm pro Portion (falls bekannt)' });
  for (const [k] of FIELDS) inputs[k] = el('input', { inputMode: 'decimal', value: val(p[k]) });
  const amountValue = el('input', { inputMode: 'decimal', value: '1' });
  const amountUnit = el('select', {},
    el('option', { value: 'servings' }, 'Portion(en) / Packung(en)'),
    el('option', { value: 'g' }, 'Gramm'));

  const notes = el('div');
  const preview = el('div', { class: 'card muted' });
  const saveBtn = el('button', { class: 'primary', onClick: onSave }, 'Speichern');

  function read() {
    const product = {
      name: name.value.trim(),
      basis: basis.value,
      servingGrams: parseNum(serving.value),
      kcal: parseNum(inputs.kcal.value),
      protein: parseNum(inputs.protein.value),
      carbs: parseNum(inputs.carbs.value),
      fat: parseNum(inputs.fat.value),
    };
    const amount = { unit: amountUnit.value, value: parseNum(amountValue.value) };
    return { product, amount };
  }

  function validate() {
    const { product, amount } = read();
    const errors = [];
    const issues = [];
    if (!product.name) errors.push('Bitte einen Namen eingeben.');
    if (product.kcal == null) errors.push('Kalorien fehlen.');
    if (!amount.value || amount.value <= 0) errors.push('Bitte eine Menge größer als 0 eingeben.');
    let scaledResult = null;
    if (!errors.length) {
      scaledResult = scaleNutrition(product, amount);
      if (scaledResult.error) {
        errors.push('Für diese Umrechnung brauche ich die Gramm pro Portion. Bitte eintragen oder die Menge in passender Einheit wählen.');
      }
    }
    for (const [k, label] of FIELDS.slice(1)) {
      if (product[k] == null) issues.push(`${label.split(' (')[0]} fehlt und zählt als 0.`);
    }
    issues.push(...checkPlausibility(product));
    return { product, amount, errors, issues, scaled: scaledResult && !scaledResult.error ? scaledResult : null };
  }

  function refresh() {
    issuesShown = false;
    saveBtn.textContent = 'Speichern';
    for (const [k] of FIELDS) inputs[k].classList.toggle('missing', parseNum(inputs[k].value) == null);
    const v = validate();
    notes.replaceChildren(...v.errors.map((e) => el('div', { class: 'note bad' }, e)));
    preview.textContent = v.scaled
      ? `Wird gespeichert: ${v.scaled.kcal} kcal · P ${v.scaled.protein ?? '–'} · KH ${v.scaled.carbs ?? '–'} · F ${v.scaled.fat ?? '–'}`
      : 'Noch keine gültige Berechnung.';
  }

  async function onSave() {
    const v = validate();
    if (v.errors.length) return refresh();
    if (v.issues.length && !issuesShown) {
      issuesShown = true;
      notes.replaceChildren(...v.issues.map((i) => el('div', { class: 'note warn' }, i)));
      saveBtn.textContent = 'Trotzdem speichern';
      return;
    }
    saveBtn.disabled = true;
    const now = new Date();
    const productId = p.productId ?? await addProduct(v.product);
    await addMeal({
      timestamp: now.toISOString(),
      dateKey: localDateKey(now),
      productId,
      name: v.product.name,
      amount: v.amount,
      ...v.scaled,
    });
    closeSheet();
    refreshCurrent();
  }

  const all = [name, basis, serving, amountValue, amountUnit, ...Object.values(inputs)];
  for (const i of all) i.addEventListener('input', refresh);

  openSheet(
    el('h1', {}, prefill ? 'Mahlzeit prüfen' : 'Mahlzeit eintragen'),
    prefill && p.productId == null && p.basis == null
      ? el('div', { class: 'note warn' }, 'Die Bezugsgröße (pro Portion oder pro 100 g) wurde nicht erkannt. Bitte am Etikett prüfen.')
      : null,
    el('label', {}, 'Name'), name,
    el('label', {}, 'Bezugsgröße der Nährwerte'), basis,
    el('label', {}, 'Gramm pro Portion (optional)'), serving,
    el('div', { class: 'grid2' },
      ...FIELDS.map(([k, label]) => el('div', {}, el('label', {}, label), inputs[k]))),
    el('label', {}, 'Gegessene Menge'),
    el('div', { class: 'grid2' }, amountValue, amountUnit),
    preview, notes,
    el('div', { class: 'actions' },
      el('button', { onClick: closeSheet }, 'Abbrechen'), saveBtn));
  refresh();
}
