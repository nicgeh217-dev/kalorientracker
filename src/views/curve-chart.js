import { el } from '../dom.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, text = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const shortDay = (dateKey) => dateKey.slice(5).split('-').reverse().map(Number).join('.') + '.';

// Verlauf einer Übung (progressCurve). Zeigt nur den Verlauf, keine Farbe sagt "besser" oder "schlechter".
export function curveChart(points) {
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) { lo -= 5; hi += 5; }
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curve', role: 'img', 'aria-label': 'Verlauf der Übung' });
  svg.append(
    sv('text', { x: 2, y: pad.t + 4, class: 'ct' }, String(Math.round(hi))),
    sv('text', { x: 2, y: H - pad.b, class: 'ct' }, String(Math.round(lo))),
    sv('polyline', { points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' '), fill: 'none', stroke: '#f2711c', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    ...points.map((p, i) => sv('circle', { cx: x(i), cy: y(p.value), r: 4, fill: '#f2711c' })),
    sv('text', { x: pad.l, y: H - 4, class: 'ct' }, shortDay(points[0].dateKey)),
    sv('text', { x: W - pad.r, y: H - 4, class: 'ct', 'text-anchor': 'end' }, shortDay(points.at(-1).dateKey)));
  return svg;
}

const CAPTION = { weight: 'Geschätztes Maximum für eine Wiederholung.', reps: 'Meiste Wiederholungen in einem Satz.' };

export const curveBlock = ({ kind, points }) => el('div', {}, curveChart(points), el('div', { class: 'muted' }, CAPTION[kind]));
