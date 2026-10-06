import { el } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { mealsForDate, deleteMeal, getSettings } from '../db.js';
import { showView } from '../nav.js';
import { openMealForm } from './meal-form.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

const R = 92;
const CIRC = 2 * Math.PI * R;

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

export async function renderToday() {
  const root = document.getElementById('view-today');
  const [meals, settings] = await Promise.all([mealsForDate(localDateKey(new Date())), getSettings()]);
  const t = dayTotals(meals);
  const goal = settings.calorieGoal;
  const progress = goal ? Math.min(1, t.kcal / goal) : 0;
  const over = goal && t.kcal > goal;
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const centerNum = goal ? Math.abs(goal - t.kcal) : t.kcal;
  const centerUnit = goal ? (over ? 'kcal drüber' : 'kcal übrig') : 'kcal gegessen';

  const macroKcal = { p: t.protein * 4, c: t.carbs * 4, f: t.fat * 9 };

  root.replaceChildren(
    el('div', { class: 'eyebrow' }, today),
    el('h1', {}, 'Heute'),
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
    el('h2', {}, 'Mahlzeiten'),
    ...(meals.length
      ? [...meals].reverse().map(mealCard)
      : [el('div', { class: 'card muted' }, 'Noch nichts eingetragen. Tippe auf die Kamera, um ein Etikett zu scannen.')]));
}

function macro(label, grams, color) {
  return el('div', { class: 'macro' },
    el('div', { class: 'lbl' }, el('span', { class: 'dot', style: `background:${color}` }), label),
    el('div', { class: 'num' }, String(grams), el('small', {}, 'g')));
}

function mealCard(m, i) {
  const time = new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const amt = m.amount ? ` · ${m.amount.value} ${m.amount.unit === 'g' ? 'g' : '×'}` : '';
  return el('div', { class: 'card meal', style: `--i:${i}` },
    el('div', { class: 'meal-top' },
      el('div', {}, el('strong', {}, m.name), el('div', { class: 'muted' }, `${time}${amt}`)),
      el('button', {
        class: 'x',
        'aria-label': `${m.name} löschen`,
        onClick: async () => {
          if (confirm(`"${m.name}" löschen?`)) {
            await deleteMeal(m.id);
            renderToday();
          }
        },
      }, '×')),
    el('div', { class: 'meal-stats' },
      el('div', { class: 'num kcal' }, String(m.kcal), el('small', {}, 'kcal')),
      mini('Protein', m.protein), mini('KH', m.carbs), mini('Fett', m.fat)));
}

function mini(label, v) {
  return el('div', { class: 'mini' }, el('b', {}, v == null ? '–' : String(v)), el('span', {}, label));
}
