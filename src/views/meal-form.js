import { el, openSheet, closeSheet, parseNum, segmented } from '../dom.js';
import { scaleNutrition, checkPlausibility, localDateKey } from '../logic.js';
import { addProduct, updateProduct, addMeal, updateMeal } from '../db.js';
import { viewedDateKey, dayLabel, longDate, timestampFor } from '../state.js';
import { showView } from '../nav.js';
import { defaultAmount, quickAmounts, amountForBasisChange } from '../amount.js';

const FIELDS = [['kcal', 'Kalorien (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Kohlenhydrate (g)'], ['fat', 'Fett (g)']];
const de = (n) => String(n).replace('.', ',');

// prefill: {name, basis, servingGrams, kcal, protein, carbs, fat, productId?, amount?} oder null (manuell)
// opts: {info?, meal? (Bearbeiten), dateKey?, estimate?, onSaved?, onCancel?, onRefine?}
// Mit Vorgabe (Scan, Produkt, Bearbeiten) zeigt das Formular nur Name, Zusammenfassung und Menge. "Werte bearbeiten" klappt den Rest auf.
export function openMealForm(prefill, opts = {}) {
  const p = prefill ?? {};
  const { info = null, meal = null, estimate = null, onSaved = null, onCancel = null, onRefine = null } = opts;
  const isEstimate = Boolean(estimate || p.estimated || meal?.estimated);
  const dateKey = opts.dateKey ?? meal?.dateKey ?? viewedDateKey();
  const today = localDateKey(new Date());
  const val = (v) => (v == null ? '' : String(v));
  const inputs = {};
  let issuesShown = false;

  const compact = prefill != null && p.kcal != null;
  const basisUnknown = prefill != null && p.productId == null && p.basis == null && !meal;
  const hasGaps = compact && (FIELDS.slice(1).some(([k]) => p[k] == null) || basisUnknown);
  // Rote Markierungen und Fehlertexte erst, wenn etwas vorgegeben war (z. B. nicht erkannte Werte) oder der Nutzer speichern wollte.
  let touched = prefill != null;
  let amountTouched = Boolean(p.amount);
  let programmatic = false;

  const name = el('input', { value: val(p.name), placeholder: 'z. B. Triangle Kimbap Thunfisch', 'aria-label': 'Name' });
  const basis = el('select', {},
    el('option', { value: 'perServing', selected: p.basis !== 'per100g', 'data-short': 'Pro Portion' }, 'Werte gelten pro Portion / Packung'),
    el('option', { value: 'per100g', selected: p.basis === 'per100g', 'data-short': 'Pro 100 g' }, 'Werte gelten pro 100 g'));
  const serving = el('input', { inputMode: 'decimal', value: val(p.servingGrams), placeholder: 'Gramm pro Portion (falls bekannt)' });
  for (const [k, label] of FIELDS) inputs[k] = el('input', { inputMode: 'decimal', value: val(p[k]), 'aria-label': label });

  const start = p.amount ?? defaultAmount({ basis: p.basis });
  const amountValue = el('input', { inputMode: 'decimal', value: de(start.value), 'aria-label': 'Menge' });
  const amountUnit = el('select', {},
    el('option', { value: 'servings', 'data-short': 'Portion' }, 'Portion(en) / Packung(en)'),
    el('option', { value: 'g', 'data-short': 'Gramm' }, 'Gramm'));
  amountUnit.value = start.unit === 'g' ? 'g' : 'servings';

  const notes = el('div');
  const summary = el('div', { class: 'fsum' });
  const preview = el('div', { class: 'fpreview' });
  const quick = el('div', { class: 'quick' });
  const saveBtn = el('button', { class: 'primary', onClick: onSave }, 'Speichern');

  const editBox = el('div', {},
    el('label', {}, 'Nährwerte gelten'), segmented(basis),
    el('label', {}, 'Gramm pro Portion (optional)'), serving,
    el('div', { class: 'grid2' }, ...FIELDS.map(([k, label]) => el('div', {}, el('label', {}, label), inputs[k]))));
  editBox.hidden = compact && !hasGaps;
  const editBtn = el('button', { class: 'small ghost', type: 'button', style: 'margin-top:10px' }, '');
  const syncEditBtn = () => { editBtn.textContent = editBox.hidden ? 'Werte bearbeiten' : 'Werte ausblenden'; };
  editBtn.addEventListener('click', () => { editBox.hidden = !editBox.hidden; syncEditBtn(); });
  syncEditBtn();

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

  function drawQuick() {
    const current = parseNum(amountValue.value);
    quick.replaceChildren(...quickAmounts(amountUnit.value).map((n) => el('button', {
      type: 'button',
      class: `chipbtn${current === n ? ' on' : ''}`,
      onClick: () => { amountTouched = true; amountValue.value = de(n); refresh(); },
    }, de(n))));
  }

  function refresh() {
    issuesShown = false;
    saveBtn.textContent = 'Speichern';
    for (const [k] of FIELDS) inputs[k].classList.toggle('missing', touched && parseNum(inputs[k].value) == null);
    const v = validate();
    notes.replaceChildren(...(touched ? v.errors.map((e) => el('div', { class: 'note bad' }, e)) : []));

    const pr = v.product;
    const basisText = pr.basis === 'per100g' ? 'pro 100 g' : 'pro Portion';
    summary.textContent = pr.kcal == null ? '' : `Nährwerte ${basisText}: ${pr.kcal} kcal · P ${pr.protein ?? '–'} · KH ${pr.carbs ?? '–'} · F ${pr.fat ?? '–'}`;
    summary.hidden = !compact;

    if (v.scaled) {
      const s = v.scaled;
      preview.replaceChildren(
        el('div', { class: 'num kcalbig' }, `${isEstimate ? '~' : ''}${s.kcal}`, el('small', {}, ' kcal')),
        el('div', { class: 'muted' }, `Protein ${s.protein ?? '–'} g · Kohlenhydrate ${s.carbs ?? '–'} g · Fett ${s.fat ?? '–'} g`));
    } else {
      preview.replaceChildren(el('div', { class: 'muted' }, 'Hier erscheint, was gespeichert wird.'));
    }
    drawQuick();
  }

  async function onSave() {
    touched = true;
    const v = validate();
    if (v.errors.length) {
      editBox.hidden = false;
      syncEditBtn();
      return refresh();
    }
    if (v.issues.length && !issuesShown) {
      issuesShown = true;
      editBox.hidden = false;
      syncEditBtn();
      refresh();
      issuesShown = true; // refresh() setzt zurück, die Bestätigung gilt für diesen Klick
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
      showView('today'); // nach dem Speichern immer zu "Heute", dort liegt der neue Eintrag
      await onSaved?.();
    } catch {
      saveBtn.disabled = false;
      notes.replaceChildren(el('div', { class: 'note bad' }, 'Speichern fehlgeschlagen (Speicher voll?). Bitte erneut versuchen.'));
    }
  }

  // Bezugsgröße gewechselt: Menge folgt mit, solange sie unberührt ist (sonst fehlt evtl. die Portionsgröße).
  basis.addEventListener('input', () => {
    const next = amountForBasisChange({
      basis: basis.value, servingGrams: parseNum(serving.value),
      current: { unit: amountUnit.value, value: parseNum(amountValue.value) ?? 1 }, touched: amountTouched,
    });
    if (next.unit !== amountUnit.value || next.value !== parseNum(amountValue.value)) {
      programmatic = true;
      amountUnit.value = next.unit;
      amountValue.value = de(next.value);
      amountUnit.dispatchEvent(new Event('input', { bubbles: true })); // aktualisiert den Segment-Schalter
      programmatic = false;
    }
  });
  amountValue.addEventListener('input', () => { amountTouched = true; });
  amountUnit.addEventListener('input', () => {
    if (!programmatic) {
      amountTouched = true;
      // Beim Einheitenwechsel eine sinnvolle Standardmenge setzen, wenn die alte nicht zur neuen Einheit passt.
      amountValue.value = de(amountUnit.value === 'g' ? 100 : 1);
    }
  });

  const all = [name, basis, serving, amountValue, amountUnit, ...Object.values(inputs)];
  for (const i of all) i.addEventListener('input', refresh);

  openSheet(
    el('h1', {}, meal ? 'Mahlzeit bearbeiten' : prefill ? 'Mahlzeit prüfen' : 'Mahlzeit eintragen'),
    dateKey !== today ? el('div', { class: 'note warn', style: 'margin-top:-4px' }, `${meal ? 'Mahlzeit von' : 'Wird eingetragen für'} ${dayLabel(dateKey)}, ${longDate(dateKey)}`) : null,
    info ? el('div', { class: 'muted', style: 'margin:-8px 4px 8px' }, info) : null,
    estimate ? estimateBanner(estimate, onRefine) : (isEstimate ? el('div', { class: 'muted', style: 'margin:-8px 4px 8px' }, '~ Dieser Eintrag ist eine Schätzung.') : null),
    basisUnknown ? el('div', { class: 'note warn' }, 'Die Bezugsgröße (pro Portion oder pro 100 g) wurde nicht erkannt. Bitte am Etikett prüfen.') : null,
    el('label', {}, 'Name'), name,
    compact ? summary : null,
    compact ? editBtn : null,
    editBox,
    el('label', {}, 'Gegessene Menge'),
    quick,
    amountValue, el('div', { style: 'height:8px' }), segmented(amountUnit),
    preview, notes,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => { onCancel?.(); closeSheet(); } }, 'Abbrechen'), saveBtn));
  refresh();
}

const CONFIDENCE = { high: 'hohe Sicherheit', medium: 'mittlere Sicherheit', low: 'geringe Sicherheit, bitte genau prüfen' };

function estimateBanner({ confidence, note, kcalMin, kcalMax }, onRefine) {
  return el('div', { class: `note ${confidence === 'low' ? 'bad' : 'warn'}` },
    el('b', {}, `Geschätzt${confidence ? ` (${CONFIDENCE[confidence]})` : ''}`),
    note ? el('div', {}, note) : null,
    kcalMin != null && kcalMax != null ? el('div', {}, `Spanne: ${kcalMin}–${kcalMax} kcal. Passe unten die Menge an, wenn du nur einen Teil gegessen hast.`) : null,
    onRefine ? el('button', { class: 'small ghost', style: 'margin-top:10px', onClick: onRefine }, 'Mit Hinweis neu schätzen') : null);
}
