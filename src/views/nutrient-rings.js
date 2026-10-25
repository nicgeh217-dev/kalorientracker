import { el } from '../dom.js';
import { ringProgress } from '../nutrients.js';
import { foodIconSvg } from './food-icons.js';

const NS = 'http://www.w3.org/2000/svg';
const R = 26;
const CIRC = 2 * Math.PI * R;
const ICON = { protein: 'drumstick', carbs: 'rice', fat: 'avocado', fiber: 'broccoli', sugar: 'candy' };
const de = (n) => String(n).replace('.', ',');

function ring(color, progress) {
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
  svg.append(
    circle('ntrack', {}),
    circle('nfg', { stroke: color, 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC * (1 - progress) }));
  return svg;
}

// Nährstoff-Kachel: Ring in der Nährstoff-Farbe (nie rot, auch bei Überschreitung), Symbol, Wert und Richtwert.
// value: Gramm oder null (unbekannt, z. B. alte Einträge ohne Ballaststoffe); target: Gramm oder null (kein Richtwert).
export function nutrientTile({ nutrient, value, target }) {
  const hasTarget = target != null && target > 0;
  const hint = !hasTarget ? '' : nutrient.id === 'sugar' ? `höchstens ${target} g` : `von ${target} g`;
  return el('div', { class: 'ntile', style: `--nc:${nutrient.color}`, 'aria-label': `${nutrient.label}: ${value == null ? 'unbekannt' : `${de(value)} g`}${hint ? `, ${hint}` : ''}` },
    el('div', { class: 'nring' },
      ring(nutrient.color, ringProgress(value, target)),
      el('div', { class: 'nicon' }, foodIconSvg(ICON[nutrient.id], 22))),
    el('div', { class: 'nval num' }, value == null ? '–' : de(value), value == null ? null : el('small', {}, 'g')),
    el('div', { class: 'nname' }, nutrient.label),
    hint ? el('div', { class: 'nhint' }, hint) : null);
}
