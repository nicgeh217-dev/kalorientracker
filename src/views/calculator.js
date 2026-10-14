import { el, openSheet, closeSheet, parseNum, segmented } from '../dom.js';
import { getSettings, saveSettings, listWeights } from '../db.js';
import { ACTIVITY, GOALS, calculateTarget, validateProfile, currentAge, bmi, minHealthyWeight } from '../calorie.js';
import { rollingAverage } from '../overview.js';
import { parseIntGoal } from '../goals.js';
import { localDateKey } from '../logic.js';
import { refreshCurrent } from '../nav.js';

const de1 = (n) => String(n).replace('.', ',');

const NOTES = {
  capped20: 'Das Defizit ist auf 20 % deines Gesamtverbrauchs begrenzt (Schutzgrenze).',
  floor: 'Das Ziel liegt an der Untergrenze: nie unter dem Grundumsatz und mindestens 1.200 kcal (Frauen) bzw. 1.500 kcal (Männer). Mehr Defizit lässt die App nicht zu.',
  noRoom: 'Dein Gesamtverbrauch liegt nahe an der Untergrenze. Ein Defizit ist hier nicht sinnvoll. Wenn du trotzdem abnehmen möchtest, sprich bitte mit einem Arzt oder einer Ärztin.',
  reachedTarget: 'Zielgewicht erreicht: Das Ziel entspricht jetzt der Erhaltung.',
};

const BLOCKED = {
  under18: 'Für unter 18-Jährige gibt es hier keine Berechnung, weil der Körper noch wächst. Bitte frag einen Arzt oder eine Ärztin.',
  underweight: 'Dein BMI liegt unter 18,5. Abnehmen ist dann nicht empfehlenswert. „Gewicht halten“ oder „Zunehmen“ sind möglich. Bitte kläre Untergewicht ärztlich.',
};

// Auswahl-Liste mit großen Tippflächen (Radio-Verhalten)
function choice(options, value, onChange) {
  const wrap = el('div', { class: 'choices', role: 'radiogroup' });
  const draw = () => {
    wrap.replaceChildren(...options.map((o) => el('button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(o.id === value),
      class: `opt${o.id === value ? ' on' : ''}`,
      onClick: () => { value = o.id; draw(); onChange(value); },
    }, el('b', {}, o.label), o.hint ? el('span', {}, o.hint) : null)));
  };
  draw();
  return { node: wrap, get: () => value };
}

export async function openCalculator() {
  const [settings, weights] = await Promise.all([getSettings(), listWeights()]);
  const prev = settings.calcProfile;
  const today = localDateKey(new Date());
  const lastAvg = rollingAverage(weights, 7).at(-1)?.kg ?? null;

  const sex = el('select', {},
    el('option', { value: 'f', selected: prev?.sex === 'f', 'data-short': 'Frau' }, 'Frau'),
    el('option', { value: 'm', selected: prev?.sex === 'm', 'data-short': 'Mann' }, 'Mann'));
  if (!prev) sex.selectedIndex = -1;
  const age = el('input', { inputMode: 'numeric', placeholder: 'z. B. 24', value: prev ? currentAge(prev) : '' });
  const height = el('input', { inputMode: 'decimal', placeholder: 'z. B. 175', value: prev?.heightCm ?? '' });
  const weight = el('input', { inputMode: 'decimal', placeholder: 'z. B. 72,5', value: lastAvg != null ? de1(lastAvg) : (prev?.calcWeightKg != null ? de1(prev.calcWeightKg) : '') });
  const auto = el('input', { type: 'checkbox', checked: prev ? settings.autoGoal !== false : true });
  auto.style.cssText = 'width:22px;min-height:22px;height:22px;flex:none';

  const activity = choice(ACTIVITY, prev?.activity ?? null, () => refresh());
  const goal = choice(GOALS, prev?.goal ?? 'hold', () => refresh());
  const result = el('div');
  const saveBtn = el('button', { class: 'primary', disabled: true }, 'Als Tagesziel übernehmen');

  function read() {
    const a = parseIntGoal(age.value, { min: 1, max: 120 });
    return {
      profile: { sex: sex.selectedIndex < 0 ? null : sex.value, age: a.ok ? a.value : null, heightCm: parseNum(height.value), activity: activity.get() },
      weightKg: parseNum(weight.value),
    };
  }

  let latest = null;
  function refresh() {
    const { profile, weightKg } = read();
    latest = null;
    saveBtn.disabled = true;
    const valid = validateProfile({ ...profile, weightKg });
    if (!valid.ok) {
      result.replaceChildren(el('div', { class: 'note warn' }, 'Fülle alle Felder aus: ' + Object.values(valid.errors).join(' ')));
      return;
    }
    const r = calculateTarget(profile, weightKg, goal.get(), settings.targetWeight ?? null);
    if (!r.ok) {
      result.replaceChildren(el('div', { class: 'note bad' }, BLOCKED[r.reason] ?? 'Mit diesen Angaben ist keine Berechnung möglich.'));
      return;
    }
    latest = { r, profile, weightKg };
    saveBtn.disabled = false;
    const sign = (n) => (n > 0 ? '+' : '') + n;
    result.replaceChildren(
      el('div', { class: 'card calc-res' },
        el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Grundumsatz'), el('b', {}, `${r.bmr} kcal`)),
        el('div', { class: 'row' }, el('span', { class: 'muted' }, `Gesamtverbrauch (× ${de1(r.pal)})`), el('b', {}, `${r.tdee} kcal`)),
        el('div', { class: 'row' }, el('span', { class: 'muted' }, 'BMI'), el('b', {}, de1(bmi(weightKg, profile.heightCm)))),
        el('div', { class: 'calc-target' }, el('span', { class: 'muted' }, 'Dein Tagesziel'), el('div', { class: 'num' }, String(r.target), el('small', {}, ' kcal'))),
        r.delta !== 0
          ? el('div', { class: 'muted' }, `Das sind ${sign(r.delta)} kcal gegenüber dem Verbrauch, rechnerisch etwa ${de1(sign(r.kgPerWeek))} kg pro Woche. Praktisch fällt die Abnahme meist geringer aus, weil der Körper sich anpasst.`)
          : null),
      ...r.notes.map((n) => el('div', { class: 'note warn' }, NOTES[n])));
  }

  async function save() {
    if (!latest) return;
    const { r, profile, weightKg } = latest;
    const fresh = await getSettings();
    await saveSettings({
      ...fresh,
      calorieGoal: r.target,
      autoGoal: auto.checked,
      suggestionDismissedWeight: null,
      calcProfile: { sex: profile.sex, age: profile.age, calcDate: today, heightCm: profile.heightCm, activity: profile.activity, goal: r.goalId, calcWeightKg: weightKg } // goalId = 'hold', falls das Zielgewicht erreicht ist,
    });
    closeSheet();
    refreshCurrent();
  }
  saveBtn.addEventListener('click', save);

  for (const i of [age, height, weight]) i.addEventListener('input', refresh);
  sex.addEventListener('input', refresh);

  const minW = prev?.heightCm ? minHealthyWeight(prev.heightCm) : null;
  openSheet(
    el('h1', {}, 'Kalorienrechner'),
    el('div', { class: 'note warn' },
      'Das Ergebnis ist ein Startwert (Abweichung im Einzelfall ±10–20 %), keine medizinische Beratung. ',
      'Bei Schwangerschaft oder Stillzeit, Diabetes, Herz- oder Nierenerkrankungen, Medikamenten oder einer Essstörung klär bitte alles ärztlich.'),
    el('label', {}, 'Geschlecht'), segmented(sex),
    el('div', { class: 'grid2' },
      el('div', {}, el('label', {}, 'Alter (Jahre)'), age),
      el('div', {}, el('label', {}, 'Größe (cm)'), height)),
    el('label', {}, 'Gewicht (kg)'), weight,
    el('label', {}, 'Aktivität (Alltag und Sport)'), activity.node,
    el('label', {}, 'Ziel'), goal.node,
    el('label', { class: 'checkrow' }, auto, el('span', {}, 'Neues Ziel vorschlagen, wenn sich mein Gewicht ändert. Ich bestätige jede Änderung selbst.')),
    minW ? el('div', { class: 'muted', style: 'margin:0 4px' }, `Mindestgewicht bei BMI 18,5: ${de1(minW)} kg.`) : null,
    result,
    el('div', { class: 'actions' }, el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'), saveBtn));
  refresh();
}
