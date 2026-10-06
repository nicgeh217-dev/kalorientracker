import { el } from '../dom.js';
import { parseWeight } from '../weight-input.js';
import { setWeight, listWeights } from '../db.js';
import { localDateKey } from '../logic.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

function chart(weights) {
  if (weights.length < 2) {
    return el('div', { class: 'muted' }, 'Das Diagramm erscheint ab zwei Einträgen.');
  }
  const W = 360, H = 180, padL = 36, padR = 10, padT = 10, padB = 24;
  const times = weights.map((w) => new Date(w.date).getTime());
  const kgs = weights.map((w) => w.kg);
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const lo = Math.floor(Math.min(...kgs) - 0.5), hi = Math.ceil(Math.max(...kgs) + 0.5);
  const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const y = (k) => padT + (1 - (k - lo) / (hi - lo || 1)) * (H - padT - padB);

  const s = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Gewichtsverlauf' });
  for (const k of [lo, (lo + hi) / 2, hi]) {
    s.append(svg('line', { x1: padL, x2: W - padR, y1: y(k), y2: y(k), stroke: '#d6e0d9' }));
    s.append(svg('text', { x: 4, y: y(k) + 4, 'font-size': 11, fill: '#5b6b62' }, k.toFixed(1)));
  }
  s.append(svg('polyline', {
    points: weights.map((w, i) => `${x(times[i])},${y(w.kg)}`).join(' '),
    fill: 'none', stroke: '#166534', 'stroke-width': 2.5, 'stroke-linejoin': 'round',
  }));
  weights.forEach((w, i) => s.append(svg('circle', { cx: x(times[i]), cy: y(w.kg), r: 3.5, fill: '#166534' })));
  const fmt = (d) => d.slice(8, 10) + '.' + d.slice(5, 7) + '.';
  s.append(svg('text', { x: padL, y: H - 6, 'font-size': 11, fill: '#5b6b62' }, fmt(weights[0].date)));
  s.append(svg('text', { x: W - padR, y: H - 6, 'font-size': 11, fill: '#5b6b62', 'text-anchor': 'end' }, fmt(weights.at(-1).date)));
  return s;
}

export async function renderWeight() {
  const root = document.getElementById('view-weight');
  const weights = await listWeights();
  const date = el('input', { type: 'date', value: localDateKey(new Date()), max: localDateKey(new Date()) });
  const kg = el('input', { inputMode: 'decimal', placeholder: 'z. B. 72,5' });
  const msg = el('div');

  const save = el('button', {
    class: 'primary',
    onClick: async () => {
      const value = parseWeight(kg.value);
      if (!date.value) return msg.replaceChildren(el('div', { class: 'note bad' }, 'Bitte ein Datum wählen.'));
      if (value == null) return msg.replaceChildren(el('div', { class: 'note bad' }, 'Bitte ein Gewicht zwischen 20 und 400 kg eingeben, z. B. 72,5.'));
      await setWeight(date.value, value);
      renderWeight();
    },
  }, 'Speichern');

  root.replaceChildren(
    el('h1', {}, 'Gewicht'),
    el('div', { class: 'card' },
      el('div', { class: 'grid2' },
        el('div', {}, el('label', {}, 'Datum'), date),
        el('div', {}, el('label', {}, 'Gewicht (kg)'), kg)),
      msg,
      el('div', { class: 'actions' }, save)),
    el('div', { class: 'card' }, chart(weights)),
    el('h2', {}, 'Verlauf'),
    ...(weights.length
      ? [...weights].reverse().slice(0, 30).map((w, i, arr) => {
          const older = arr[i + 1];
          const diff = older ? w.kg - older.kg : null;
          const d = w.date.split('-').reverse().join('.');
          return el('div', { class: 'card row' },
            el('strong', {}, `${w.kg.toFixed(1).replace('.', ',')} kg`),
            el('span', { class: 'muted' }, `${d}${diff == null ? '' : ` · ${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')}`}`));
        })
      : [el('div', { class: 'muted' }, 'Noch kein Gewicht eingetragen.')]));
}
