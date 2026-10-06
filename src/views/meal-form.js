import { el, openSheet, closeSheet, parseNum, segmented } from '../dom.js';
import { scaleNutrition, checkPlausibility, localDateKey } from '../logic.js';
import { addProduct, updateProduct, addMeal, updateMeal } from '../db.js';
import { viewedDateKey, dayLabel, longDate, timestampFor } from '../state.js';
import { refreshCurrent } from '../nav.js';

const FIELDS = [['kcal', 'Kalorien (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Kohlenhydrate (g)'], ['fat', 'Fett (g)']];

// prefill: {name, basis, servingGrams, kcal, protein, carbs, fat, productId?, amount?} oder null
// opts: {info?: string, meal?: bestehende Mahlzeit (Bearbeiten), dateKey?: Tag für neue Mahlzeiten}
export function openMealForm(prefill, opts = {}) {
  const p = prefill ?? {};
  const { info = null, meal = null, estimate = null } = opts;
  const isEstimate = Boolean(estimate || p.estimated || meal?.estimated);
  const dateKey = opts.dateKey ?? meal?.dateKey ?? viewedDateKey();
  const today = localDateKey(new Date());
  const val = (v) => (v == null ? '' : String(v));
  const inputs = {};
  let issuesShown = false;

  const name = el('input', { value: val(p.name), placeholder: 'z. B. Triangle Kimbap Thunfisch' });
  const basis = el('select', {},
    el('option', { value: 'perServing', selected: p.basis !== 'per100g', 'data-short': 'Pro Portion' }, 'Werte gelten pro Portion / Packung'),
    el('option', { value: 'per100g', selected: p.basis === 'per100g', 'data-short': 'Pro 100 g' }, 'Werte gelten pro 100 g'));
  const serving = el('input', { inputMode: 'decimal', value: val(p.servingGrams), placeholder: 'Gramm pro Portion (falls bekannt)' });
  for (const [k] of FIELDS) inputs[k] = el('input', { inputMode: 'decimal', value: val(p[k]) });
  const amountValue = el('input', { inputMode: 'decimal', value: val(p.amount?.value ?? 1) });
  const amountUnit = el('select', {},
    el('option', { value: 'servings', 'data-short': 'Portion' }, 'Portion(en) / Packung(en)'),
    el('option', { value: 'g', 'data-short': 'Gramm' }, 'Gramm'));
  amountUnit.value = p.amount?.unit === 'g' ? 'g' : 'servings';

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
    if (!isEstimate) { // Schätzungen sind per Definition ungenau: keine zusätzliche Bestätigung nötig
      for (const [k, label] of FIELDS.slice(1)) {
        if (product[k] == null) issues.push(`${label.split(' (')[0]} fehlt und zählt als 0.`);
      }
      issues.push(...checkPlausibility(product));
    }
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
      // Kurz sperren, damit ein Doppeltipp die Warnung nicht überspringt.
      saveBtn.disabled = true;
      setTimeout(() => { saveBtn.disabled = false; }, 800);
      return;
    }
    saveBtn.disabled = true;
    try {
      let productId = p.productId;
      const stored = isEstimate ? { ...v.product, estimated: true } : v.product;
      if (productId != null) await updateProduct({ id: productId, ...stored });
      else productId = await addProduct(stored);
      const data = { productId, name: v.product.name, amount: v.amount, ...v.scaled, ...(isEstimate ? { estimated: true } : {}) };
      if (meal) {
        await updateMeal({ ...meal, ...data }); // id, Zeitstempel und Tag bleiben erhalten
      } else {
        await addMeal({ timestamp: timestampFor(dateKey), dateKey, ...data });
      }
      closeSheet();
      refreshCurrent();
    } catch {
      saveBtn.disabled = false;
      notes.replaceChildren(el('div', { class: 'note bad' }, 'Speichern fehlgeschlagen (Speicher voll?). Bitte erneut versuchen.'));
    }
  }

  const all = [name, basis, serving, amountValue, amountUnit, ...Object.values(inputs)];
  for (const i of all) i.addEventListener('input', refresh);

  openSheet(
    el('h1', {}, meal ? 'Mahlzeit bearbeiten' : prefill ? 'Mahlzeit prüfen' : 'Mahlzeit eintragen'),
    dateKey !== today ? el('div', { class: 'note warn', style: 'margin-top:-4px' }, `${meal ? 'Mahlzeit von' : 'Wird eingetragen für'} ${dayLabel(dateKey)}, ${longDate(dateKey)}`) : null,
    info ? el('div', { class: 'muted', style: 'margin:-8px 4px 8px' }, info) : null,
    estimate ? estimateBanner(estimate) : (isEstimate ? el('div', { class: 'muted', style: 'margin:-8px 4px 8px' }, '~ Dieser Eintrag ist eine Schätzung.') : null),
    prefill && p.productId == null && p.basis == null
      ? el('div', { class: 'note warn' }, 'Die Bezugsgröße (pro Portion oder pro 100 g) wurde nicht erkannt. Bitte am Etikett prüfen.')
      : null,
    el('label', {}, 'Name'), name,
    el('label', {}, 'Nährwerte gelten'), segmented(basis),
    el('label', {}, 'Gramm pro Portion (optional)'), serving,
    el('div', { class: 'grid2' },
      ...FIELDS.map(([k, label]) => el('div', {}, el('label', {}, label), inputs[k]))),
    el('label', {}, 'Gegessene Menge'),
    amountValue, el('div', { style: 'height:8px' }), segmented(amountUnit),
    preview, notes,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'), saveBtn));
  refresh();
}

const CONFIDENCE = { high: 'hohe Sicherheit', medium: 'mittlere Sicherheit', low: 'geringe Sicherheit, bitte genau prüfen' };

function estimateBanner({ confidence, note, kcalMin, kcalMax }) {
  return el('div', { class: `note ${confidence === 'low' ? 'bad' : 'warn'}` },
    el('b', {}, `Geschätzt${confidence ? ` (${CONFIDENCE[confidence]})` : ''}`),
    note ? el('div', {}, note) : null,
    kcalMin != null && kcalMax != null ? el('div', {}, `Spanne: ${kcalMin}–${kcalMax} kcal. Passe unten die Menge an, wenn du nur einen Teil gegessen hast.`) : null);
}
