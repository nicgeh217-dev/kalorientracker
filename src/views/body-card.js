import { el } from '../dom.js';
import { METRICS, sleepPhasesText } from '../health-metrics.js';

// Werte aus Health Connect (Fitbit, Google Health). Nur Zahlen, kein Ziel und keine Farbe für gut oder schlecht.
// enabled: die in den Einstellungen eingeschalteten Werte (enabledMetrics).

const chosen = (enabled) => METRICS.filter((m) => enabled.includes(m.id));

// Karte auf "Heute": Kacheln in Reihen zu je 4, darunter die Schlafphasen. null, wenn es für den Tag keine Werte gibt.
export function bodyCard(day, enabled) {
  if (!day) return null;
  const tiles = chosen(enabled).map((m) => m.tile(day)).filter(Boolean);
  const phases = enabled.includes('sleep') ? sleepPhasesText(day) : null;
  if (!tiles.length) return null;
  return el('div', { class: 'card bodycard' },
    el('div', { class: 'bodyhead' }, 'Körper'),
    el('div', { class: 'bodyrow' },
      ...tiles.map((t) => el('div', { class: 'bodyval' },
        el('div', { class: 'nval num' }, t.value, t.unit ? el('small', {}, t.unit) : null),
        el('div', { class: 'nname' }, t.label)))),
    phases ? el('div', { class: 'bodyphases' }, `Schlafphasen: ${phases}`) : null);
}

// Eine Zeile für die Tageskarte im Verlauf. null ohne Werte.
export function bodyLine(day, enabled, limit = Infinity) {
  if (!day) return null;
  const parts = chosen(enabled).map((m) => m.text(day)).filter(Boolean).slice(0, limit);
  return parts.length ? parts.join(' · ') : null;
}

// Farbe je Bereich, wie bei den Karten auf Heute: Schlaf, Bewegung, Herz. Alles andere bleibt orange.
const GROUP = { sleep: 'var(--c-sleep)', steps: 'var(--c-move)', distance: 'var(--c-move)', floors: 'var(--c-move)', kcal: 'var(--c-move)', restingHr: 'var(--c-heart)', hr: 'var(--c-heart)', hrv: 'var(--c-heart)', spo2: 'var(--c-heart)', respRate: 'var(--c-heart)' };
export const accentFor = (chartId) => GROUP[String(chartId).split(':')[0]] ?? 'var(--orange)';

// Kurven für die Karte "Körper" im Verlauf.
export const bodyCharts = (enabled) => chosen(enabled).flatMap((m) => m.chart.map((c) => ({ ...c, id: `${m.id}:${c.label}` })));
