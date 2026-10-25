import { el } from '../dom.js';
import { ringProgress } from '../nutrients.js';
import { foodIconSvg } from './food-icons.js';

const NS = 'http://www.w3.org/2000/svg';
const R = 26;
const CIRC = 2 * Math.PI * R;
const ICON = { protein: 'drumstick', carbs: 'rice', fat: 'avocado', fiber: 'broccoli', sugar: 'candy' };
const de = (n) => String(n).replace('.', ',');

// animateTo: Zielwert, dann füllt sich der Ring von `progress` dorthin (Übergang per CSS, bei reduzierter Bewegung sofort).
function ring(color, progress, animateTo = null) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  const circle = (cls, attrs) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', cls);
    c.setAttribute('cx', '32');
    c.setAttribute('cy', '32');
    c.setAttribute('r', String(R));
    for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v);
    return c;
  };
  const fg = circle('nfg', { stroke: color, 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC * (1 - progress) });
  svg.append(circle('ntrack', {}), fg);
  if (animateTo != null) {
    fg.classList.add('grow');
    requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', CIRC * (1 - animateTo))));
  }
  return svg;
}

// Nährstoff-Kachel: Ring in der Nährstoff-Farbe (nie rot, auch bei Überschreitung), Symbol, Wert und Richtwert.
// from: Vorwert für die Füll-Animation (nur direkt nach dem Eintragen), sonst undefined.
// value: Gramm oder null (unbekannt, z. B. alte Einträge ohne Ballaststoffe); target: Gramm oder null (kein Richtwert).
export function nutrientTile({ nutrient, value, target, from }) {
  const hasTarget = target != null && target > 0;
  const hint = !hasTarget ? '' : nutrient.id === 'sugar' ? `höchstens ${target} g` : `von ${target} g`;
  return el('div', { class: 'ntile', style: `--nc:${nutrient.color}`, 'aria-label': `${nutrient.label}: ${value == null ? 'unbekannt' : `${de(value)} g`}${hint ? `, ${hint}` : ''}` },
    el('div', { class: 'nring' },
      ring(nutrient.color, ringProgress(from !== undefined ? from : value, target), from !== undefined ? ringProgress(value, target) : null),
      el('div', { class: 'nicon' }, foodIconSvg(ICON[nutrient.id], 22))),
    el('div', { class: 'nval num' }, el('span', { class: 'nv' }, value == null ? '–' : de(value)), value == null ? null : el('small', {}, 'g')),
    el('div', { class: 'nname' }, nutrient.label),
    hint ? el('div', { class: 'nhint' }, hint) : null);
}
