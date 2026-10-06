import { el } from '../dom.js';
import { parseWeight } from '../weight-input.js';
import { setWeight, listWeights } from '../db.js';
import { localDateKey } from '../logic.js';
import { rollingAverage } from '../overview.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const de = (n) => n.toFixed(1).replace('.', ',');

function chart(weights, avgs) {
  if (weights.length < 2) {
    return el('div', { class: 'muted' }, 'Das Diagramm erscheint ab zwei Einträgen.');
  }
  const W = 360, H = 190, padL = 34, padR = 12, padT = 14, padB = 26;
  const times = weights.map((w) => new Date(w.date).getTime());
  const kgs = weights.map((w) => w.kg);
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const lo = Math.floor(Math.min(...kgs) - 0.5), hi = Math.ceil(Math.max(...kgs) + 0.5);
  const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const y = (k) => padT + (1 - (k - lo) / (hi - lo || 1)) * (H - padT - padB);

  const avgLine = avgs.map((w, i) => `${x(times[i])},${y(w.kg)}`).join(' ');
  const s = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Gewichtsverlauf' });
  const defs = svg('defs');
  const grad = svg('linearGradient', { id: 'wGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.append(svg('stop', { offset: '0', 'stop-color': '#fc4c02', 'stop-opacity': '.32' }), svg('stop', { offset: '1', 'stop-color': '#fc4c02', 'stop-opacity': '0' }));
  defs.append(grad);
  s.append(defs);
  for (const k of [lo, (lo + hi) / 2, hi]) {
    s.append(svg('line', { x1: padL, x2: W - padR, y1: y(k), y2: y(k), stroke: 'currentColor', 'stroke-opacity': '.1' }));
    s.append(svg('text', { x: 0, y: y(k) + 4, 'font-size': 11, 'font-weight': 600, fill: 'currentColor', 'fill-opacity': '.5' }, k.toFixed(1)));
  }
  const pts = weights.map((w, i) => [x(times[i]), y(w.kg)]);
  const line = pts.map(([px, py]) => `${px},${py}`).join(' ');
  s.append(svg('polygon', { points: `${pts[0][0]},${H - padB} ${line} ${pts.at(-1)[0]},${H - padB}`, fill: 'url(#wGrad)' }));
  s.append(svg('polyline', { points: avgLine, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.55', 'stroke-width': 2, 'stroke-dasharray': '5 5', 'stroke-linecap': 'round' }));
  s.append(svg('polyline', { points: line, fill: 'none', stroke: '#fc4c02', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  const [lx, ly] = pts.at(-1);
  s.append(svg('circle', { cx: lx, cy: ly, r: 8, fill: '#fc4c02', 'fill-opacity': '.2' }));
  s.append(svg('circle', { cx: lx, cy: ly, r: 4.5, fill: '#fc4c02', stroke: 'var(--card)', 'stroke-width': 2 }));
  const fmt = (d) => d.slice(8, 10) + '.' + d.slice(5, 7) + '.';
  s.append(svg('text', { x: padL, y: H - 6, 'font-size': 11, 'font-weight': 600, fill: 'currentColor', 'fill-opacity': '.5' }, fmt(weights[0].date)));
  s.append(svg('text', { x: W - padR, y: H - 6, 'font-size': 11, 'font-weight': 600, fill: 'currentColor', 'fill-opacity': '.5', 'text-anchor': 'end' }, fmt(weights.at(-1).date)));
  return s;
}

export async function renderWeight() {
  const root = document.getElementById('view-weight');
  const weights = await listWeights();
  const avgs = rollingAverage(weights, 7);
  const latest = weights.at(-1);
  const latestAvg = avgs.at(-1);
  const prev = weights.at(-2);
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

  const diff = latest && prev ? latest.kg - prev.kg : null;

  root.replaceChildren(
    el('div', { class: 'eyebrow' }, 'Körpergewicht'),
    el('h1', {}, 'Gewicht'),
    el('div', { class: 'card weight-hero' },
      latest
        ? el('div', { class: 'row' },
            el('div', {}, el('div', { class: 'num' }, de(latest.kg).replace(',', ','), el('small', {}, 'kg')),
              el('div', { class: 'muted' }, latest.date.split('-').reverse().join('.'))),
            diff == null ? null : el('span', { class: `chip${diff < 0 ? ' down' : ''}` }, `${diff > 0 ? '+' : ''}${de(diff)} kg`))
        : el('div', { class: 'muted' }, 'Noch kein Gewicht eingetragen.'),
      latestAvg
        ? el('div', { class: 'row', style: 'margin-top:12px' },
            el('span', { class: 'muted' }, '7-Tage-Schnitt'),
            el('span', { class: 'num', style: 'font-size:30px' }, de(latestAvg.kg), el('small', { style: 'font-family:var(--font);font-style:normal;font-size:13px;color:var(--muted)' }, ' kg')))
        : null,
      el('div', { style: 'margin-top:12px' }, chart(weights, avgs)),
      weights.length > 1 ? el('div', { class: 'legend' }, el('span', { style: 'color:#fc4c02' }, '● Einzelwerte'), el('span', {}, '- - 7-Tage-Schnitt (glättet Schwankungen)')) : null),
    el('div', { class: 'card' },
      el('div', { class: 'grid2' },
        el('div', {}, el('label', { style: 'margin-top:0' }, 'Datum'), date),
        el('div', {}, el('label', { style: 'margin-top:0' }, 'Gewicht (kg)'), kg)),
      msg,
      el('div', { class: 'actions' }, el('div', { class: 'wide', style: 'display:grid' }, save))),
    el('h2', {}, 'Verlauf'),
    ...(weights.length
      ? [el('div', { class: 'card', style: 'padding-top:6px;padding-bottom:6px' },
          ...[...weights].reverse().slice(0, 30).map((w, i, arr) => {
            const older = arr[i + 1];
            const d = older ? w.kg - older.kg : null;
            return el('div', { class: 'wrow row' },
              el('div', { class: 'num' }, de(w.kg), el('small', { class: 'muted', style: 'font-family:var(--font);font-style:normal;font-size:13px' }, ' kg')),
              el('span', { class: 'muted' }, `${w.date.split('-').reverse().join('.')}${d == null ? '' : ` · ${d > 0 ? '+' : ''}${de(d)}`}`));
          }))]
      : []));
}
