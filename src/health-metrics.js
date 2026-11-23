import { formatSleep } from './vitals.js';

// Welche Werte aus Health Connect die App kennt: Health-Connect-Typen, Anzeige auf "Heute" (tile),
// Zeile im Verlauf (text) und Kurven (chart). Nur Zahlen, keine Bewertung.

const fmt = (n, digits = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const has = (v) => Number.isFinite(v);
const hours = (min) => (min > 0 ? Math.round(min / 6) / 10 : undefined);
const burned = (d) => d.totalKcal ?? d.activeKcal;

export const METRICS = [
  {
    id: 'steps', label: 'Schritte', hc: ['steps'],
    tile: (d) => (has(d.steps) ? { value: fmt(d.steps), label: 'Schritte' } : null),
    text: (d) => (has(d.steps) ? `${fmt(d.steps)} Schritte` : null),
    chart: [{ label: 'Schritte', caption: 'Schritte pro Tag.', value: (d) => d.steps }],
  },
  {
    id: 'distance', label: 'Strecke', hc: ['distance'],
    tile: (d) => (has(d.distanceM) ? { value: fmt(d.distanceM / 1000, 1), unit: 'km', label: 'Strecke' } : null),
    text: (d) => (has(d.distanceM) ? `${fmt(d.distanceM / 1000, 1)} km` : null),
    chart: [{ label: 'Strecke', caption: 'Strecke pro Tag in Kilometern.', value: (d) => (has(d.distanceM) ? Math.round(d.distanceM / 100) / 10 : undefined) }],
  },
  {
    id: 'floors', label: 'Stockwerke', hc: ['flightsClimbed'],
    tile: (d) => (has(d.floors) ? { value: fmt(d.floors), label: 'Stockwerke' } : null),
    text: (d) => (has(d.floors) ? `${fmt(d.floors)} Stockwerke` : null),
    chart: [{ label: 'Stockwerke', caption: 'Stockwerke pro Tag.', value: (d) => d.floors }],
  },
  {
    // Gesamt wie in Google Health. Liefert Health Connect nur die aktiven Kalorien, steht das dabei.
    id: 'kcal', label: 'Verbrannte Kalorien', hc: ['calories', 'totalCalories'],
    tile: (d) => (has(burned(d)) ? { value: fmt(burned(d)), unit: 'kcal', label: d.totalKcal != null ? 'verbrannt' : 'aktiv verbrannt' } : null),
    text: (d) => (has(burned(d)) ? `${fmt(burned(d))} kcal ${d.totalKcal != null ? 'verbrannt' : 'aktiv verbrannt'}` : null),
    chart: [{ label: 'Kalorien', caption: 'Verbrannte Kalorien pro Tag.', value: burned }],
  },
  {
    id: 'restingHr', label: 'Ruhepuls', hc: ['restingHeartRate'],
    tile: (d) => (has(d.restingHr) ? { value: String(d.restingHr), unit: 'bpm', label: 'Ruhepuls' } : null),
    text: (d) => (has(d.restingHr) ? `Ruhepuls ${d.restingHr}` : null),
    chart: [{ label: 'Ruhepuls', caption: 'Ruhepuls in Schlägen pro Minute.', value: (d) => d.restingHr }],
  },
  {
    id: 'hr', label: 'Puls', hc: ['heartRate'],
    tile: (d) => (has(d.hrAvg) ? { value: String(d.hrAvg), unit: 'bpm', label: 'Puls Ø' } : null),
    text: (d) => (has(d.hrAvg) ? `Puls Ø ${d.hrAvg}${has(d.hrMin) && has(d.hrMax) ? ` (${d.hrMin} bis ${d.hrMax})` : ''}` : null),
    chart: [{ label: 'Puls', caption: 'Durchschnittlicher Puls pro Tag.', value: (d) => d.hrAvg }],
  },
  {
    id: 'hrv', label: 'HRV', hc: ['heartRateVariability'],
    tile: (d) => (has(d.hrv) ? { value: String(d.hrv), unit: 'ms', label: 'HRV' } : null),
    text: (d) => (has(d.hrv) ? `HRV ${d.hrv} ms` : null),
    chart: [{ label: 'HRV', caption: 'Herzfrequenzvariabilität in Millisekunden.', value: (d) => d.hrv }],
  },
  {
    id: 'spo2', label: 'Sauerstoff', hc: ['oxygenSaturation'],
    tile: (d) => (has(d.spo2) ? { value: String(d.spo2), unit: '%', label: 'Sauerstoff' } : null),
    text: (d) => (has(d.spo2) ? `Sauerstoff ${d.spo2} %` : null),
    chart: [{ label: 'Sauerstoff', caption: 'Sauerstoffsättigung in Prozent.', value: (d) => d.spo2 }],
  },
  {
    id: 'respRate', label: 'Atemfrequenz', hc: ['respiratoryRate'],
    tile: (d) => (has(d.respRate) ? { value: String(d.respRate), unit: '/min', label: 'Atmung' } : null),
    text: (d) => (has(d.respRate) ? `Atemfrequenz ${d.respRate}/min` : null),
    chart: [{ label: 'Atmung', caption: 'Atemzüge pro Minute.', value: (d) => d.respRate }],
  },
  {
    id: 'vo2max', label: 'VO2max', hc: ['vo2Max'],
    tile: (d) => (has(d.vo2max) ? { value: String(d.vo2max), label: 'VO2max' } : null),
    text: (d) => (has(d.vo2max) ? `VO2max ${d.vo2max}` : null),
    chart: [{ label: 'VO2max', caption: 'VO2max in ml/kg/min.', value: (d) => d.vo2max }],
  },
  {
    id: 'sleep', label: 'Schlaf', hc: ['sleep'],
    tile: (d) => (d.sleepMin > 0 ? { value: formatSleep(d.sleepMin), label: 'Schlaf' } : null),
    text: (d) => (d.sleepMin > 0 ? `Schlaf ${formatSleep(d.sleepMin)}` : null),
    chart: [
      { label: 'Schlaf', caption: 'Schlaf pro Nacht in Stunden.', value: (d) => hours(d.sleepMin) },
      { label: 'Tiefschlaf', caption: 'Tiefschlaf pro Nacht in Stunden.', value: (d) => hours(d.sleepDeep) },
      { label: 'REM', caption: 'REM-Schlaf pro Nacht in Stunden.', value: (d) => hours(d.sleepRem) },
    ],
  },
  {
    id: 'bodyFat', label: 'Körperfett', hc: ['bodyFat'],
    tile: (d) => (has(d.bodyFat) ? { value: fmt(d.bodyFat, 1), unit: '%', label: 'Körperfett' } : null),
    text: (d) => (has(d.bodyFat) ? `Körperfett ${fmt(d.bodyFat, 1)} %` : null),
    chart: [{ label: 'Körperfett', caption: 'Körperfett in Prozent.', value: (d) => d.bodyFat }],
  },
  // Gewicht und Trainings erscheinen an ihren eigenen Stellen (Gewicht, Training), nicht in der Karte "Körper".
  { id: 'weight', label: 'Gewicht', hc: ['weight'], tile: () => null, text: () => null, chart: [] },
  { id: 'workouts', label: 'Trainings', hc: ['workouts'], tile: () => null, text: () => null, chart: [] },
];

const ALL = METRICS.map((m) => m.id);

// Ohne Auswahl (erstes Verbinden, oder nach dem Update) ist alles eingeschaltet.
export const enabledMetrics = (settings) => settings?.health?.metrics ?? ALL;

export const hcTypesFor = (ids) => METRICS.filter((m) => ids.includes(m.id)).flatMap((m) => m.hc);

// Schlafphasen als Zeile unter der Karte, z. B. "Tief 1 h 20 min · REM 1 h 40 min". null ohne Phasen.
export function sleepPhasesText(d) {
  const parts = [['Tief', d.sleepDeep], ['REM', d.sleepRem], ['Leicht', d.sleepLight], ['Wach', d.sleepAwake]]
    .filter(([, v]) => v > 0).map(([label, v]) => `${label} ${formatSleep(v)}`);
  return parts.length ? parts.join(' · ') : null;
}
