import { el } from '../dom.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, text = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const shortDay = (dateKey) => dateKey.slice(5).split('-').reverse().map(Number).join('.') + '.';

// Verlauf einer Übung oder eines Körperwerts. Zeigt nur den Verlauf, keine Farbe sagt "besser" oder "schlechter".
// opts.accent: Farbe der Linie (CSS-Wert, z. B. var(--c-sleep)), dazu eine sanfte Fläche darunter. Ohne bleibt es orange wie bisher.
// opts.range: {lo, hi}, dein üblicher Bereich als graue Spanne hinter der Kurve.
export function curveChart(points, { accent = null, range = null } = {}) {
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  // Gleichbleibende Werte: Rand nach Größe der Zahl (Stunden brauchen weniger als Schritte), nie unter 0.
  if (hi === lo) { const pad = Math.max(Math.abs(hi) * 0.1, 0.5); lo = Math.max(0, lo - pad); hi += pad; }
  // Die graue Spanne soll im Bild liegen, auch wenn die Kurve sie nicht ganz erreicht.
  if (range) { lo = Math.min(lo, range.lo); hi = Math.max(hi, range.hi); }
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curve', role: 'img', 'aria-label': 'Verlauf der Übung' });
  const color = accent ? { style: `stroke:${accent}` } : { stroke: '#f2711c' };
  const dot = accent ? { style: `fill:${accent}` } : { fill: '#f2711c' };
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  if (range) svg.append(sv('rect', { class: 'crange', x: pad.l, width: W - pad.l - pad.r, y: y(range.hi), height: Math.max(2, y(range.lo) - y(range.hi)), rx: 4 }));
  if (accent && points.length > 1) svg.append(sv('polygon', { class: 'carea', style: `fill:${accent}`, points: `${x(0)},${H - pad.b} ${line} ${x(points.length - 1)},${H - pad.b}` }));
  svg.append(
    sv('text', { x: 2, y: pad.t + 4, class: 'ct' }, String(Math.round(hi))),
    sv('text', { x: 2, y: H - pad.b, class: 'ct' }, String(Math.round(lo))),
    sv('polyline', { points: line, fill: 'none', ...color, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    // Mit Akzent: nur der letzte Tag als Punkt (ruhiger bei 30 Tagen), sonst jeder Tag wie bisher.
    ...points.map((p, i) => (accent && i < points.length - 1 ? null : sv('circle', { cx: x(i), cy: y(p.value), r: accent ? 5 : 4, ...dot }))).filter(Boolean),
    sv('text', { x: pad.l, y: H - 4, class: 'ct' }, shortDay(points[0].dateKey)),
    sv('text', { x: W - pad.r, y: H - 4, class: 'ct', 'text-anchor': 'end' }, shortDay(points.at(-1).dateKey)));
  return svg;
}

const CAPTION = { weight: 'Geschätztes Maximum für eine Wiederholung.', reps: 'Meiste Wiederholungen in einem Satz.' };

export const curveBlock = ({ kind, points }) => el('div', {}, curveChart(points), el('div', { class: 'muted' }, CAPTION[kind]));

// Kleine Linie ohne Achsen, z. B. fürs Gewicht im Wochenrückblick. Neutrale Farbe: Sie zeigt den Verlauf, kein Urteil.
export function miniLine(values) {
  const W = 120;
  const H = 32;
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const x = (i) => 3 + (i / (values.length - 1)) * (W - 6);
  const y = (v) => H - 3 - ((v - lo) / span) * (H - 6);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'miniline', 'aria-hidden': 'true' });
  svg.append(sv('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return svg;
}
