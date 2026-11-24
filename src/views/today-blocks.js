import { el, openSheet, closeSheet } from '../dom.js';
import { NUTRIENTS, ringProgress } from '../nutrients.js';
import { METRICS } from '../health-metrics.js';
import { nutrientTile } from './nutrient-rings.js';
import { openMetricDetail } from './body-dash.js';

// Bausteine für "Heute" in der Android-App (ruhiges Layout): drei Makro-Balken statt fünf Ringe, Körperwerte als Kacheln.

const de = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const MACROS = ['protein', 'carbs', 'fat'];

// Drei dünne Balken: Protein, Kohlenhydrate, Fett. Antippen öffnet alle Nährstoffe.
export function macroBars({ nutrientValue, targets, onOpen }) {
  return el('button', { type: 'button', class: 'macros2', 'aria-label': 'Alle Nährstoffe ansehen', onClick: onOpen },
    ...MACROS.map((id) => {
      const n = NUTRIENTS.find((x) => x.id === id);
      const value = nutrientValue(id) ?? 0;
      const target = targets?.[id] ?? null;
      const pct = Math.round(Math.min(1, ringProgress(value, target)) * 100);
      return el('div', { class: 'macro2', style: `--nc:${n.color}` },
        el('div', { class: 'm2label' }, n.short ?? n.label),
        el('div', { class: 'm2value' }, `${de(value)}${target ? ` / ${de(target)}` : ''} g`),
        el('div', { class: 'm2bar', 'aria-hidden': 'true' }, el('i', { style: `width:${pct}%` })));
    }),
    el('span', { class: 'm2chev', 'aria-hidden': 'true' }, '›'));
}

// Alle fünf Nährstoffe in einem Fenster (die Ringe, die früher auf Heute standen).
export function openNutrientSheet({ nutrientValue, targets }) {
  openSheet(
    el('h1', {}, 'Nährstoffe'),
    el('div', { class: 'card' }, el('div', { class: 'ntiles', style: 'margin:0;padding:0;border:0;background:none' },
      ...NUTRIENTS.map((n) => nutrientTile({ nutrient: n, value: nutrientValue(n.id), target: targets?.[n.id] ?? null })))),
    el('div', { class: 'actions' }, el('button', { class: 'primary wide', onClick: closeSheet }, 'Schließen')));
}

// Reihenfolge der Kacheln: Schlaf und Schritte zuerst, dann Herz, dann der Rest. Nur Werte mit Daten, höchstens vier.
const TILE_ORDER = ['sleep', 'steps', 'restingHr', 'hrv', 'kcal', 'hr', 'spo2', 'distance', 'floors', 'respRate'];
const GROUP_COLOR = { sleep: 'var(--c-sleep)', steps: 'var(--c-move)', kcal: 'var(--c-move)', distance: 'var(--c-move)', floors: 'var(--c-move)', restingHr: 'var(--c-heart)', hrv: 'var(--c-heart)', hr: 'var(--c-heart)', spo2: 'var(--c-heart)', respRate: 'var(--c-heart)' };
const ICON = {
  sleep: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  steps: 'M8 4c2 0 3 2 3 4s-1 3-3 3-3-1-3-3 1-4 3-4zM16 10c2 0 3 2 3 4s-1 4-3 4-3-1-3-3 1-5 3-5z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
};
const ICON_OF = { sleep: 'sleep', steps: 'steps', distance: 'steps', floors: 'steps', kcal: 'bolt' };

function icon(id) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICON[ICON_OF[id] ?? 'heart']);
  svg.append(p);
  return svg;
}

export function bodyTiles({ day, vitals, enabled, dateKey }) {
  if (!day) return null;
  const tiles = TILE_ORDER
    .filter((id) => enabled.includes(id))
    .map((id) => ({ id, t: METRICS.find((m) => m.id === id)?.tile(day) }))
    .filter((x) => x.t)
    .slice(0, 4);
  if (!tiles.length) return null;
  return el('div', { class: 'bodytiles' }, ...tiles.map(({ id, t }) => el('button', {
    type: 'button', class: 'bodytile', style: `--accent:${GROUP_COLOR[id]}`, 'aria-label': `${t.label} öffnen`,
    onClick: () => openMetricDetail({ metricId: id, day, vitals, dateKey }),
  },
    el('div', { class: 'btop' }, el('span', { class: 'bicon' }, icon(id)), el('span', { class: 'blabel' }, t.label), el('span', { class: 'bchev', 'aria-hidden': 'true' }, '›')),
    el('div', { class: 'bvalue' }, t.value, t.unit ? el('small', {}, t.unit) : null))));
}
