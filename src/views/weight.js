import { el, mount } from '../dom.js';
import { parseWeight } from '../weight-input.js';
import { setWeight, listWeights, getSettings } from '../db.js';
import { localDateKey } from '../logic.js';
import { rollingAverage, forecast } from '../overview.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const de = (n) => n.toFixed(1).replace('.', ',');

function chart(weights, avgs, target) {
  if (weights.length < 2) {
    return el('div', { class: 'muted' }, 'Das Diagramm erscheint ab zwei Einträgen.');
  }
  const W = 360, H = 190, padL = 34, padR = 12, padT = 14, padB = 26;
  const times = weights.map((w) => new Date(w.date).getTime());
  const kgs = weights.map((w) => w.kg);
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const withTarget = target == null ? kgs : [...kgs, target];
  const lo = Math.floor(Math.min(...withTarget) - 0.5), hi = Math.ceil(Math.max(...withTarget) + 0.5);
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
  if (target != null) {
    s.append(svg('line', { x1: padL, x2: W - padR, y1: y(target), y2: y(target), stroke: '#1f9d55', 'stroke-width': 2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }));
    s.append(svg('text', { x: W - padR, y: y(target) - 5, 'font-size': 11, 'font-weight': 700, fill: '#1f9d55', 'text-anchor': 'end' }, `Ziel ${target.toString().replace('.', ',')}`));
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
  const target = (await getSettings()).targetWeight ?? null;
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

  mount(root,
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
      el('div', { style: 'margin-top:12px' }, chart(weights, avgs, target)),
      weights.length > 1 ? el('div', { class: 'legend' }, el('span', { style: 'color:#fc4c02' }, '● Einzelwerte'), el('span', {}, '- - 7-Tage-Schnitt (glättet Schwankungen)')) : null),
    target != null && latest ? goalCard(weights, latest, target) : null,
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

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function goalCard(weights, latest, target) {
  const f = forecast(weights, target);
  const left = Math.abs(latest.kg - target);
  const text = {
    reached: 'Ziel erreicht. Jetzt Gewicht halten.',
    nodata: 'Für eine Prognose brauche ich mindestens 3 Einträge aus 7 Tagen.',
    flat: 'Dein Gewicht ist zurzeit stabil. Mit diesem Verlauf erreichst du das Ziel nicht.',
    wrongway: 'Dein Trend geht gerade vom Ziel weg.',
    far: 'Beim aktuellen Tempo dauert es mehr als 2 Jahre.',
  }[f.status];
  return el('div', { class: 'card' },
    el('div', { class: 'row' },
      el('span', { class: 'muted' }, 'Zielgewicht'),
      el('span', { class: 'num', style: 'font-size:30px' }, de(target), el('small', { style: 'font-family:var(--font);font-style:normal;font-size:13px;color:var(--muted)' }, ' kg'))),
    el('div', { class: 'muted', style: 'margin-top:6px' }, f.status === 'reached' ? '' : `Noch ${de(left)} kg ${latest.kg > target ? 'abnehmen' : 'zunehmen'}.`),
    f.status === 'ok'
      ? el('div', { class: 'note warn', style: 'margin-bottom:0' }, `Prognose: etwa am ${fmtDate(f.date)} (${f.perWeek > 0 ? '+' : ''}${de(f.perWeek)} kg pro Woche). Grobe Schätzung aus den letzten 4 Wochen.`)
      : el('div', { class: 'muted', style: 'margin-top:6px' }, text));
}
