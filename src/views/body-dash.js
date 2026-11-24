import { el, openSheet, closeSheet } from '../dom.js';
import { METRICS } from '../health-metrics.js';
import { formatSleep } from '../vitals.js';
import { typicalRange, lastValues, phaseBar, trackPosition } from '../vitals-view.js';
import { curveChart } from './curve-chart.js';
import { addDays } from '../overview.js';

// Karten "Schlaf", "Bewegung" und "Herz" auf Heute, in Anlehnung an Bevel Health: ein großer Wert je Karte, kleiner Verlauf, dein üblicher Bereich.
// Nur Zahlen. Die graue Spanne zeigt, was für dich üblich ist, sie sagt nie gut oder schlecht. Antippen öffnet die Kurve.

const fmt = (n, digits = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const has = (v) => Number.isFinite(v);
const hours1 = (min) => (min > 0 ? Math.round(min / 6) / 10 : undefined);
const burned = (d) => d.totalKcal ?? d.activeKcal;

// Ein Wert: wie er heißt, wie man ihn liest und auf welche Zahl sich Verlauf und Bereich beziehen.
const V = {
  sleep: { id: 'sleep', label: 'Schlaf', value: (d) => (d.sleepMin > 0 ? d.sleepMin : undefined), show: (v) => formatSleep(v), caption: 'Schlaf pro Nacht in Stunden.', chart: (d) => hours1(d.sleepMin) },
  deep: { id: 'sleep', label: 'Tiefschlaf', value: (d) => (d.sleepDeep > 0 ? d.sleepDeep : undefined), show: (v) => formatSleep(v), caption: 'Tiefschlaf pro Nacht in Stunden.', chart: (d) => hours1(d.sleepDeep) },
  rem: { id: 'sleep', label: 'REM', value: (d) => (d.sleepRem > 0 ? d.sleepRem : undefined), show: (v) => formatSleep(v), caption: 'REM-Schlaf pro Nacht in Stunden.', chart: (d) => hours1(d.sleepRem) },
  steps: { id: 'steps', label: 'Schritte', value: (d) => d.steps, show: (v) => fmt(v), caption: 'Schritte pro Tag.', chart: (d) => d.steps },
  distance: { id: 'distance', label: 'Strecke', value: (d) => d.distanceM, show: (v) => `${fmt(v / 1000, 1)} km`, caption: 'Strecke pro Tag in Kilometern.', chart: (d) => (has(d.distanceM) ? Math.round(d.distanceM / 100) / 10 : undefined) },
  floors: { id: 'floors', label: 'Stockwerke', value: (d) => d.floors, show: (v) => fmt(v), caption: 'Stockwerke pro Tag.', chart: (d) => d.floors },
  kcal: { id: 'kcal', label: 'Verbrannt', value: burned, show: (v) => `${fmt(v)} kcal`, caption: 'Verbrannte Kalorien pro Tag.', chart: burned },
  restingHr: { id: 'restingHr', label: 'Ruhepuls', value: (d) => d.restingHr, show: (v) => `${v} bpm`, caption: 'Ruhepuls in Schlägen pro Minute.', chart: (d) => d.restingHr },
  hr: { id: 'hr', label: 'Puls Ø', value: (d) => d.hrAvg, show: (v) => `${v} bpm`, caption: 'Durchschnittlicher Puls pro Tag.', chart: (d) => d.hrAvg },
  hrv: { id: 'hrv', label: 'HRV', value: (d) => d.hrv, show: (v) => `${v} ms`, caption: 'Herzfrequenzvariabilität in Millisekunden.', chart: (d) => d.hrv },
  spo2: { id: 'spo2', label: 'Sauerstoff', value: (d) => d.spo2, show: (v) => `${v} %`, caption: 'Sauerstoffsättigung in Prozent.', chart: (d) => d.spo2 },
  respRate: { id: 'respRate', label: 'Atmung', value: (d) => d.respRate, show: (v) => `${v} /min`, caption: 'Atemzüge pro Minute.', chart: (d) => d.respRate },
};

// Welche Werte zu welcher Karte gehören (und ob sie eingeschaltet sind).
const GROUPS = {
  sleep: ['sleep', 'deep', 'rem'],
  move: ['steps', 'distance', 'floors', 'kcal'],
  heart: ['restingHr', 'hr', 'hrv', 'spo2', 'respRate'],
};

function bars(values, accent) {
  const present = values.filter((v) => v != null);
  const max = Math.max(...present, 1);
  return el('div', { class: 'spark', 'aria-hidden': 'true', style: `--accent:${accent}` },
    ...values.map((v, i) => el('i', { class: i === values.length - 1 ? 'today' : '', style: `height:${v == null ? 3 : Math.max(8, (v / max) * 100)}%` })));
}

// Linie mit grauer Spanne (dein üblicher Bereich) und einem Punkt für den gewählten Tag.
function track(value, range, series, accent) {
  const pos = trackPosition(value, range, series);
  if (!pos) return null;
  return el('div', { class: 'rtrack', 'aria-hidden': 'true', style: `--accent:${accent}` },
    el('span', { class: 'rband', style: `left:${pos.bandStart * 100}%;width:${(pos.bandEnd - pos.bandStart) * 100}%` }),
    el('span', { class: 'rdot', style: `left:${pos.dot * 100}%` }));
}

function context(v, day, vitals, dateKey, accent) {
  const series = lastValues(vitals, v.value, dateKey);
  const range = typicalRange(vitals, v.value, dateKey);
  const value = v.value(day);
  return { series, range, value, bars: bars(series, accent), track: has(value) ? track(value, range, series.filter((x) => x != null), accent) : null, rangeText: range ? `üblich ${v.show(range.lo)} bis ${v.show(range.hi)}` : null };
}

function card({ title, accent, hero, sub, extra, onOpen, children }) {
  return el('button', { type: 'button', class: 'card bodydash', style: `--accent:${accent}`, 'aria-label': `${title} öffnen`, onClick: onOpen },
    el('div', { class: 'bdhead' }, el('span', { class: 'bddot' }), title),
    hero, sub, ...(children ?? []), extra);
}

function sleepCard(day, vitals, dateKey, on) {
  const v = V.sleep;
  if (!on.includes('sleep') || !has(v.value(day))) return null;
  const c = context(v, day, vitals, dateKey, 'var(--c-sleep)');
  const bar = phaseBar(day);
  return card({
    title: 'Schlaf', accent: 'var(--c-sleep)',
    hero: el('div', { class: 'bdhero' }, el('span', { class: 'num' }, formatSleep(day.sleepMin))),
    sub: bar ? el('div', {},
      el('div', { class: 'phasebar', 'aria-hidden': 'true' }, ...bar.map((p) => el('i', { class: `ph-${p.key}`, style: `flex:${p.frac}` }))),
      el('div', { class: 'phaselegend' }, ...bar.map((p) => el('span', {}, el('i', { class: `ph-${p.key}` }), `${p.label} ${formatSleep(p.min)}`)))) : null,
    children: [c.bars, c.track, c.rangeText ? el('div', { class: 'bdrange' }, c.rangeText) : null],
    onOpen: () => openDetail('Schlaf', ['sleep', 'deep', 'rem'], vitals, dateKey, 'var(--c-sleep)'),
  });
}

function moveCard(day, vitals, dateKey, on) {
  const picked = GROUPS.move.filter((k) => on.includes(V[k].id) && has(V[k].value(day)));
  if (!picked.length) return null;
  const main = V[picked[0]];
  const rest = picked.slice(1).map((k) => `${V[k].show(V[k].value(day))}${k === 'floors' ? ' Stockwerke' : ''}${k === 'kcal' ? ' verbrannt' : ''}`);
  const c = context(main, day, vitals, dateKey, 'var(--c-move)');
  return card({
    title: 'Bewegung', accent: 'var(--c-move)',
    hero: el('div', { class: 'bdhero' }, el('span', { class: 'num' }, main.show(main.value(day))), el('span', { class: 'bdunit' }, main.id === 'steps' ? 'Schritte' : main.label)),
    sub: rest.length ? el('div', { class: 'bdrow' }, ...rest.map((t) => el('span', {}, t))) : null,
    children: [c.bars, c.track, c.rangeText ? el('div', { class: 'bdrange' }, c.rangeText) : null],
    onOpen: () => openDetail('Bewegung', picked, vitals, dateKey, 'var(--c-move)'),
  });
}

function heartCard(day, vitals, dateKey, on) {
  const picked = GROUPS.heart.filter((k) => on.includes(V[k].id === 'hr' ? 'hr' : V[k].id) && has(V[k].value(day)));
  if (!picked.length) return null;
  const tiles = picked.map((k) => {
    const v = V[k];
    const c = context(v, day, vitals, dateKey, 'var(--c-heart)');
    return el('div', { class: 'bdtile' },
      el('div', { class: 'nval num' }, v.show(v.value(day))),
      el('div', { class: 'nname' }, v.label),
      c.track);
  });
  return card({
    title: 'Herz', accent: 'var(--c-heart)',
    hero: null, sub: el('div', { class: 'bdtiles' }, ...tiles),
    extra: el('div', { class: 'bdrange' }, 'Graue Spanne: dein üblicher Bereich der letzten 30 Tage'),
    onOpen: () => openDetail('Herz', picked, vitals, dateKey, 'var(--c-heart)'),
  });
}

// Rest, der in keine Karte passt, in einer ruhigen Zeile.
function otherLine(day, on) {
  const items = METRICS.filter((m) => on.includes(m.id) && ['vo2max', 'bodyFat'].includes(m.id)).map((m) => m.text(day)).filter(Boolean);
  return items.length ? el('div', { class: 'bdother' }, items.join(' · ')) : null;
}

export function bodyDash({ day, vitals, enabled, dateKey }) {
  if (!day) return null;
  const cards = [sleepCard(day, vitals, dateKey, enabled), moveCard(day, vitals, dateKey, enabled), heartCard(day, vitals, dateKey, enabled), otherLine(day, enabled)].filter(Boolean);
  return cards.length ? el('div', { class: 'bodydashwrap' }, ...cards) : null;
}

// Detail: Kurve der letzten 30 Tage, Chips zum Umschalten, dein üblicher Bereich in Worten.
function openDetail(title, keys, vitals, dateKey, accent) {
  let current = keys[0];
  const body = el('div');
  const draw = () => {
    const v = V[current];
    const from = addDays(dateKey, -29);
    const points = vitals.filter((d) => d.dateKey >= from && d.dateKey <= dateKey && has(v.chart(d))).map((d) => ({ dateKey: d.dateKey, value: v.chart(d) }));
    const range = typicalRange(vitals, v.value, dateKey);
    const chartRange = typicalRange(vitals, v.chart, dateKey); // in der Einheit der Kurve (z. B. Stunden)
    body.replaceChildren(
      keys.length > 1 ? el('div', { class: 'chips', style: 'margin:8px -16px 12px' }, ...keys.map((k) => el('button', {
        class: k === current ? 'on' : '', 'aria-pressed': k === current ? 'true' : 'false', onClick: () => { current = k; draw(); },
      }, el('b', {}, V[k].label)))) : null,
      points.length ? curveChart(points, { accent, range: chartRange }) : el('div', { class: 'muted' }, 'Noch keine Werte.'),
      el('div', { class: 'muted' }, `${v.caption} Letzte 30 Tage, aus Health Connect.`),
      range ? el('div', { style: 'margin-top:12px' }, `Dein üblicher Bereich: ${v.show(range.lo)} bis ${v.show(range.hi)} (Mitte ${v.show(range.median)}), aus ${range.n} Tagen.`) : el('div', { class: 'muted', style: 'margin-top:12px' }, 'Dein üblicher Bereich erscheint ab 7 Tagen mit Werten.'));
  };
  draw();
  openSheet(el('h1', { style: `border-left:4px solid ${accent};padding-left:12px` }, title), body,
    el('div', { class: 'actions' }, el('button', { class: 'primary wide', onClick: closeSheet }, 'Schließen')));
}
