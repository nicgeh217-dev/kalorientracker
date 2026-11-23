import { el } from '../dom.js';
import { formatSleep } from '../vitals.js';

// Werte aus Health Connect (Fitbit, Google Health). Nur Zahlen, kein Ziel und keine Farbe für gut oder schlecht.
const fmt = (n) => n.toLocaleString('de-DE');
const burned = (day) => day.totalKcal ?? day.activeKcal;

function items(day) {
  if (!day) return [];
  return [
    Number.isFinite(day.steps) ? { label: 'Schritte', value: fmt(day.steps), text: `${fmt(day.steps)} Schritte` } : null,
    // Gesamt wie in Google Health. Liefert Health Connect nur die aktiven Kalorien, steht das dabei.
    Number.isFinite(burned(day)) ? { label: day.totalKcal != null ? 'verbrannt' : 'aktiv verbrannt', value: fmt(burned(day)), unit: 'kcal', text: `${fmt(burned(day))} kcal ${day.totalKcal != null ? 'verbrannt' : 'aktiv verbrannt'}` } : null,
    Number.isFinite(day.restingHr) ? { label: 'Ruhepuls', value: String(day.restingHr), unit: 'bpm', text: `Ruhepuls ${day.restingHr}` } : null,
    day.sleepMin > 0 ? { label: 'Schlaf', value: formatSleep(day.sleepMin), text: `Schlaf ${formatSleep(day.sleepMin)}` } : null,
  ].filter(Boolean);
}

// Karte auf "Heute". null, wenn es für den Tag keine Werte gibt.
export function bodyCard(day) {
  const list = items(day);
  if (!list.length) return null;
  return el('div', { class: 'card bodycard' },
    el('div', { class: 'bodyhead' }, 'Körper'),
    el('div', { class: 'bodyrow', style: `grid-template-columns:repeat(${list.length}, minmax(0, 1fr))` },
      ...list.map((i) => el('div', { class: 'bodyval' },
        el('div', { class: 'nval num' }, i.value, i.unit ? el('small', {}, i.unit) : null),
        el('div', { class: 'nname' }, i.label)))));
}

// Eine Zeile für die Tageskarte im Verlauf. null ohne Werte.
export function bodyLine(day) {
  const list = items(day);
  return list.length ? list.map((i) => i.text).join(' · ') : null;
}

export const BODY_METRICS = [
  { id: 'steps', label: 'Schritte', caption: 'Schritte pro Tag.', value: (d) => d.steps },
  { id: 'kcal', label: 'Kalorien', caption: 'Verbrannte Kalorien pro Tag.', value: burned },
  { id: 'hr', label: 'Ruhepuls', caption: 'Ruhepuls in Schlägen pro Minute.', value: (d) => d.restingHr },
  { id: 'sleep', label: 'Schlaf', caption: 'Schlaf pro Nacht in Stunden.', value: (d) => (d.sleepMin > 0 ? Math.round(d.sleepMin / 6) / 10 : undefined) },
];
