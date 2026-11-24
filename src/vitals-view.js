import { addDays } from './overview.js';

// Rechnen für die Karten "Körper": dein üblicher Bereich, die letzten 7 Tage, Schlafphasen.
// Nur Zahlen zum Ansehen, keine Bewertung: Die Spanne zeigt, was für dich üblich ist, nicht was gut ist.

const RANGE_DAYS = 30;
const MIN_DAYS = 7;

function percentile(sorted, p) {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

// Mittlere Hälfte (25 bis 75 %) der letzten 30 Tage vor dem gewählten Tag. null bei weniger als 7 Tagen mit Wert.
export function typicalRange(days, value, todayKey) {
  const from = addDays(todayKey, -RANGE_DAYS);
  const values = days
    .filter((d) => d.dateKey >= from && d.dateKey < todayKey)
    .map(value).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (values.length < MIN_DAYS) return null;
  return { lo: percentile(values, 0.25), hi: percentile(values, 0.75), median: percentile(values, 0.5), n: values.length };
}

// Die letzten n Tage bis einschließlich dem gewählten Tag, älteste zuerst. Fehlende Tage sind null.
export function lastValues(days, value, todayKey, n = 7) {
  const byDay = new Map(days.map((d) => [d.dateKey, d]));
  return Array.from({ length: n }, (_, i) => {
    const d = byDay.get(addDays(todayKey, i - (n - 1)));
    const v = d ? value(d) : undefined;
    return Number.isFinite(v) ? v : null;
  });
}

const PHASES = [['deep', 'Tief', 'sleepDeep'], ['rem', 'REM', 'sleepRem'], ['light', 'Leicht', 'sleepLight'], ['awake', 'Wach', 'sleepAwake']];

// Streifen für den Schlafphasen-Balken. null ohne Phasen.
export function phaseBar(day) {
  const parts = PHASES.map(([key, label, field]) => ({ key, label, min: day?.[field] })).filter((p) => p.min > 0);
  const total = parts.reduce((s, p) => s + p.min, 0);
  if (!total) return null;
  return parts.map((p) => ({ ...p, frac: Math.round((p.min / total) * 10000) / 10000 }));
}

// Lage von Spanne und Punkt auf einer Linie von 0 bis 1. Die Skala reicht über alle Werte, Ausreißer bleiben am Rand im Bild.
export function trackPosition(value, range, series) {
  if (!range || !Number.isFinite(value)) return null;
  const all = [...series.filter((v) => Number.isFinite(v)), range.lo, range.hi, value];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = span * 0.08;
  const lo = min - pad;
  const scale = span + pad * 2;
  const at = (v) => Math.min(1, Math.max(0, (v - lo) / scale));
  return { bandStart: at(range.lo), bandEnd: at(range.hi), dot: at(value) };
}
