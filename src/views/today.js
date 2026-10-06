import { el, toast } from '../dom.js';
import { dayTotals } from '../logic.js';
import { addDays, weekSummary, pickRecent } from '../overview.js';
import { mealsForDate, deleteMeal, getSettings, addMeal, listMeals, getProduct } from '../db.js';
import { showView } from '../nav.js';
import { viewedDateKey, isViewingToday, setViewedDateKey, dayLabel, longDate, timestampFor } from '../state.js';
import { openMealForm } from './meal-form.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

const R = 92;
const CIRC = 2 * Math.PI * R;
const BAR_AREA = 80; // px Höhe für Balken in der Wochenansicht

function ring(progress) {
  const s = svg('svg', { viewBox: '0 0 220 220', 'aria-hidden': 'true' });
  const defs = svg('defs');
  const g = svg('linearGradient', { id: 'ringGrad', x1: '0', y1: '0', x2: '1', y2: '1' });
  g.append(svg('stop', { offset: '0', 'stop-color': '#fc4c02' }), svg('stop', { offset: '1', 'stop-color': '#ff8a3d' }));
  defs.append(g);
  const track = svg('circle', { class: 'track', cx: 110, cy: 110, r: R });
  const fg = svg('circle', { class: 'fg', cx: 110, cy: 110, r: R, 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC });
  s.append(defs, track, fg);
  // Beim ersten Zeichnen füllt sich der Ring von 0 aus.
  requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', CIRC * (1 - progress))));
  return s;
}

function go(dateKey) {
  setViewedDateKey(dateKey);
  return renderToday();
}

export async function renderToday() {
  const root = document.getElementById('view-today');
  const dateKey = viewedDateKey();
  const isToday = isViewingToday();
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(dateKey, i - 6));
  const [settings, weekMeals, everyMeal] = await Promise.all([
    getSettings(),
    Promise.all(weekKeys.map((k) => mealsForDate(k))),
    listMeals(),
  ]);
  const meals = weekMeals[6];
  const t = dayTotals(meals);
  const goal = settings.calorieGoal;
  const progress = goal ? Math.min(1, t.kcal / goal) : 0;
  const over = goal && t.kcal > goal;
  const centerNum = goal ? Math.abs(goal - t.kcal) : t.kcal;
  const centerUnit = goal ? (over ? 'kcal drüber' : 'kcal übrig') : 'kcal gegessen';
  const macroKcal = { p: t.protein * 4, c: t.carbs * 4, f: t.fat * 9 };

  const weekDays = weekKeys.map((k, i) => ({ dateKey: k, kcal: dayTotals(weekMeals[i]).kcal, meals: weekMeals[i].length }));
  const recent = pickRecent(everyMeal, 6);

  root.replaceChildren(
    el('div', { class: 'dayhead' },
      el('div', {}, el('div', { class: 'eyebrow' }, longDate(dateKey)), el('h1', {}, dayLabel(dateKey))),
      el('div', { class: 'daynav' },
        el('button', { 'aria-label': 'Vorheriger Tag', onClick: () => go(addDays(dateKey, -1)) }, '‹'),
        el('button', { 'aria-label': 'Nächster Tag', disabled: isToday, onClick: () => go(addDays(dateKey, 1)) }, '›'))),
    el('div', { class: 'card hero' },
      el('div', { class: `ring${over ? ' over' : ''}` },
        ring(progress),
        el('div', { class: 'center' },
          el('div', { class: 'num' }, String(centerNum)),
          el('div', { class: 'unit' }, centerUnit))),
      goal
        ? el('div', { class: 'hero-meta' },
            el('div', {}, el('b', {}, String(t.kcal)), 'Gegessen'),
            el('div', {}, el('b', {}, String(goal)), 'Ziel'))
        : el('div', { class: 'note warn', style: 'margin-bottom:0' }, 'Noch kein Kalorienziel. ',
            el('a', { href: '#', onClick: (e) => { e.preventDefault(); showView('settings'); } }, 'In den Einstellungen eintragen'))),
    el('div', { class: 'card' },
      el('div', { class: 'macros' },
        macro('Protein', t.protein, 'var(--p)'),
        macro('Kohlenhydr.', t.carbs, 'var(--c)'),
        macro('Fett', t.fat, 'var(--f)')),
      el('div', { class: 'split', 'aria-hidden': 'true' },
        el('i', { style: `flex-grow:${macroKcal.p};background:var(--p)` }),
        el('i', { style: `flex-grow:${macroKcal.c};background:var(--c)` }),
        el('i', { style: `flex-grow:${macroKcal.f};background:var(--f)` }))),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => openMealForm(null) }, 'Manuell eintragen'),
      el('button', { class: 'btn', onClick: () => showView('products') }, 'Aus Produkten')),
    recent.length ? el('h2', {}, 'Zuletzt gegessen') : null,
    recent.length ? el('div', { class: 'chips' }, ...recent.map((m) => recentChip(m, dateKey))) : null,
    el('h2', {}, 'Mahlzeiten'),
    ...(meals.length
      ? [...meals].reverse().map(mealCard)
      : [el('div', { class: 'card muted' }, isToday
          ? 'Noch nichts eingetragen. Tippe auf die Kamera, um ein Etikett zu scannen.'
          : 'Für diesen Tag ist nichts eingetragen. Du kannst es mit den Buttons oben nachtragen.')]),
    el('h2', {}, 'Letzte 7 Tage'),
    weekCard(weekDays, goal, dateKey));
}

function macro(label, grams, color) {
  return el('div', { class: 'macro' },
    el('div', { class: 'lbl' }, el('span', { class: 'dot', style: `background:${color}` }), label),
    el('div', { class: 'num' }, String(grams), el('small', {}, 'g')));
}

function recentChip(m, dateKey) {
  return el('button', {
    onClick: async () => {
      const id = await addMeal({
        timestamp: timestampFor(dateKey), dateKey, productId: m.productId, name: m.name, amount: m.amount,
        kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
      });
      toast(`${m.name} eingetragen`, 'Rückgängig', async () => { await deleteMeal(id); renderToday(); });
      renderToday();
    },
  }, el('b', {}, m.name), el('span', {}, `${m.kcal} kcal`));
}

function weekCard(days, goal, selected) {
  const s = weekSummary(days, goal);
  const maxVal = Math.max(goal || 0, ...days.map((d) => d.kcal), 1);
  const bars = el('div', { class: 'bars' },
    goal ? el('div', { class: 'goalline', style: `bottom:${22 + (goal / maxVal) * BAR_AREA}px` }) : null,
    ...days.map((d) => {
      const [y, m, dd] = d.dateKey.split('-').map(Number);
      const wd = new Date(y, m - 1, dd).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
      const cls = [d.meals ? 'has' : '', goal && d.kcal > goal ? 'over' : '', d.dateKey === selected ? 'sel' : ''].join(' ').trim();
      return el('button', { class: cls, 'aria-label': `${dayLabel(d.dateKey)}: ${d.kcal} kcal`, onClick: () => go(d.dateKey) },
        el('i', { style: `height:${Math.max(4, (d.kcal / maxVal) * BAR_AREA)}px` }), wd);
    }));
  return el('div', { class: 'card' },
    el('div', { class: 'week-stats' },
      el('div', {}, el('div', { class: 'num' }, s.avgKcal == null ? '–' : String(s.avgKcal)), el('div', { class: 'lbl' }, 'Ø kcal pro Tag')),
      goal ? el('div', {}, el('div', { class: 'num' }, `${s.daysInGoal}/${s.loggedDays}`), el('div', { class: 'lbl' }, 'Tage im Ziel')) : null),
    bars,
    el('div', { class: 'legend' },
      el('span', {}, 'Der Schnitt zählt nur Tage mit Einträgen.'),
      goal ? el('span', {}, '- - Ziel') : null));
}

async function editMeal(m) {
  const product = m.productId != null ? await getProduct(m.productId) : null;
  const prefill = product
    ? { ...product, productId: product.id, amount: m.amount }
    : { name: m.name, basis: 'perServing', servingGrams: null, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, amount: { unit: 'servings', value: 1 } };
  openMealForm(prefill, { meal: m });
}

function mealCard(m, i) {
  const time = new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const amt = m.amount ? ` · ${m.amount.value} ${m.amount.unit === 'g' ? 'g' : '×'}` : '';
  return el('div', { class: 'card meal', style: `--i:${i}` },
    el('div', { class: 'meal-top' },
      el('div', {}, el('strong', {}, m.name), el('div', { class: 'muted' }, `${time}${amt}`)),
      el('div', { class: 'xrow' },
        el('button', { class: 'x', 'aria-label': `${m.name} bearbeiten`, onClick: () => editMeal(m) }, '✎'),
        el('button', {
          class: 'x',
          'aria-label': `${m.name} löschen`,
          onClick: async () => {
            if (confirm(`"${m.name}" löschen?`)) {
              await deleteMeal(m.id);
              renderToday();
            }
          },
        }, '×'))),
    el('div', { class: 'meal-stats' },
      el('div', { class: 'num kcal' }, String(m.kcal), el('small', {}, 'kcal')),
      mini('Protein', m.protein), mini('KH', m.carbs), mini('Fett', m.fat)));
}

function mini(label, v) {
  return el('div', { class: 'mini' }, el('b', {}, v == null ? '–' : String(v)), el('span', {}, label));
}
