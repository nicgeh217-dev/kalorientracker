import { localDateKey } from './logic.js';
import { addDays } from './overview.js';
import { fitbitTrainingDays } from './vitals.js';

// Zusammenhänge: Die App vergleicht auf dem Handy zwei Gruppen von Tagen und meldet nur deutliche Unterschiede.
// Gemini bekommt nur diese Ergebnisse und formuliert sie freundlich. Gewicht ist bewusst nicht dabei.

const WINDOW_DAYS = 56;
const MIN_DAYS = 5;
const MIN_PCT = 10;
const SHORT_NIGHT = 360; // unter 6 h
const LONG_NIGHT = 420; // ab 7 h
const LATE_HOUR = 21;

const fmt = (n, digits = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: digits });
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const DIGITS = { kcal: 0, g: 0, h: 1, bpm: 0 };
const roundTo = (x, unit) => { const f = 10 ** DIGITS[unit]; return Math.round(x * f) / f; };

// Ein Tag mit allem, was die Vergleiche brauchen. Krankheitstage fallen ganz heraus.
function dayTable({ meals, vitals, workouts, days, todayKey }) {
  const sick = new Set(days.filter((d) => d.status === 'sick').map((d) => d.dateKey));
  const vit = new Map(vitals.map((v) => [v.dateKey, v]));
  const trained = new Set([...workouts.filter((w) => w.sets?.length).map((w) => w.dateKey), ...fitbitTrainingDays(vitals, workouts)]);
  const mealsBy = new Map();
  for (const m of meals) (mealsBy.get(m.dateKey) ?? mealsBy.set(m.dateKey, []).get(m.dateKey)).push(m);
  const rows = [];
  for (let i = WINDOW_DAYS; i >= 1; i -= 1) {
    const key = addDays(todayKey, -i);
    if (sick.has(key)) continue;
    const list = mealsBy.get(key) ?? [];
    // Uhrzeit nur von Mahlzeiten, die am selben Tag eingetragen wurden: Nachgetragene tragen die Uhrzeit des Nachtragens.
    const sameDay = list.filter((m) => m.timestamp && localDateKey(new Date(m.timestamp)) === key);
    const lastHour = sameDay.length ? Math.max(...sameDay.map((m) => { const t = new Date(m.timestamp); return t.getHours() + t.getMinutes() / 60; })) : null;
    const v = vit.get(key) ?? {};
    const next = vit.get(addDays(key, 1)) ?? {};
    const dow = new Date(`${key}T12:00:00`).getDay();
    rows.push({
      key,
      kcal: list.length ? list.reduce((s, m) => s + (m.kcal ?? 0), 0) : null,
      protein: list.length ? list.reduce((s, m) => s + (m.protein ?? 0), 0) : null,
      sleep: v.sleepMin > 0 ? v.sleepMin : null,
      sleepNext: next.sleepMin > 0 ? next.sleepMin : null,
      steps: Number.isFinite(v.steps) ? v.steps : null,
      restingHr: Number.isFinite(v.restingHr) ? v.restingHr : null,
      trained: trained.has(key),
      lastHour,
      weekend: dow === 0 || dow === 6,
    });
  }
  return rows;
}

function compare(rows, { id, text, unit, thresholds, a, b, value, scale = 1 }) {
  const valid = rows.filter((r) => value(r) != null);
  const A = valid.filter(a.when).map((r) => value(r) * scale);
  const B = valid.filter(b.when).map((r) => value(r) * scale);
  if (A.length < MIN_DAYS || B.length < MIN_DAYS) return null;
  const ma = roundTo(mean(A), unit);
  const mb = roundTo(mean(B), unit);
  const smaller = Math.min(ma, mb);
  if (smaller <= 0) return null;
  const pct = Math.round((Math.abs(ma - mb) / smaller) * 100);
  if (pct < MIN_PCT) return null;
  return { id, text, unit, thresholds, a: { label: a.label, mean: ma, n: A.length }, b: { label: b.label, mean: mb, n: B.length }, diff: roundTo(Math.abs(ma - mb), unit), pct };
}

const median = (xs) => { const s = [...xs].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

export function computeFindings({ meals, vitals, workouts, days, todayKey }) {
  const rows = dayTable({ meals, vitals, workouts, days, todayKey });
  const short = { label: 'nach Nächten unter 6 h', when: (r) => r.sleep < SHORT_NIGHT };
  const long = { label: 'nach Nächten ab 7 h', when: (r) => r.sleep >= LONG_NIGHT };
  const withSteps = rows.filter((r) => r.steps != null && r.kcal != null).map((r) => r.steps);
  const stepMedian = withSteps.length ? Math.round(median(withSteps)) : null;
  const H = 1 / 60;
  const list = [
    compare(rows.filter((r) => r.sleep != null), { id: 'sleep_kcal', text: 'Gegessene Kalorien nach kurzen und langen Nächten', unit: 'kcal', thresholds: [6, 7], a: short, b: long, value: (r) => r.kcal }),
    stepMedian == null ? null : compare(rows.filter((r) => r.steps != null), {
      id: 'steps_kcal', text: 'Gegessene Kalorien an Tagen mit vielen und wenigen Schritten', unit: 'kcal', thresholds: [stepMedian],
      a: { label: `an Tagen mit mehr als ${fmt(stepMedian)} Schritten`, when: (r) => r.steps > stepMedian },
      b: { label: `an Tagen mit weniger als ${fmt(stepMedian)} Schritten`, when: (r) => r.steps < stepMedian }, value: (r) => r.kcal,
    }),
    compare(rows, { id: 'training_kcal', text: 'Gegessene Kalorien an Trainingstagen', unit: 'kcal', thresholds: [], a: { label: 'an Trainingstagen', when: (r) => r.trained }, b: { label: 'an Tagen ohne Training', when: (r) => !r.trained }, value: (r) => r.kcal }),
    compare(rows, { id: 'training_protein', text: 'Gegessenes Protein an Trainingstagen', unit: 'g', thresholds: [], a: { label: 'an Trainingstagen', when: (r) => r.trained }, b: { label: 'an Tagen ohne Training', when: (r) => !r.trained }, value: (r) => r.protein }),
    compare(rows, { id: 'training_sleep', text: 'Schlaf in der Nacht nach einem Trainingstag', unit: 'h', thresholds: [], a: { label: 'nach Trainingstagen', when: (r) => r.trained }, b: { label: 'nach Tagen ohne Training', when: (r) => !r.trained }, value: (r) => r.sleepNext, scale: H }),
    compare(rows.filter((r) => r.lastHour != null), { id: 'late_sleep', text: 'Schlaf nach spätem Essen', unit: 'h', thresholds: [LATE_HOUR], a: { label: 'letzte Mahlzeit ab 21 Uhr', when: (r) => r.lastHour >= LATE_HOUR }, b: { label: 'letzte Mahlzeit vor 21 Uhr', when: (r) => r.lastHour < LATE_HOUR }, value: (r) => r.sleepNext, scale: H }),
    compare(rows, { id: 'weekend_kcal', text: 'Gegessene Kalorien am Wochenende', unit: 'kcal', thresholds: [], a: { label: 'Samstag und Sonntag', when: (r) => r.weekend }, b: { label: 'Montag bis Freitag', when: (r) => !r.weekend }, value: (r) => r.kcal }),
    compare(rows.filter((r) => r.sleep != null), { id: 'sleep_restinghr', text: 'Ruhepuls nach kurzen und langen Nächten', unit: 'bpm', thresholds: [6, 7], a: short, b: long, value: (r) => r.restingHr }),
  ];
  return list.filter(Boolean).sort((x, y) => y.pct - x.pct);
}

// Zahlen, die Gemini verwenden darf: alles Gelieferte, auch gerundet auf ganze Zahlen, Zehner und Hunderter.
export function allowedNumbers(findings) {
  const out = new Set([1, WINDOW_DAYS]);
  const add = (x) => { if (!Number.isFinite(x)) return; for (const v of [x, Math.round(x), Math.round(x / 10) * 10, Math.round(x / 100) * 100]) out.add(v); };
  for (const f of findings) [f.a.mean, f.b.mean, f.a.n, f.b.n, f.diff, f.pct, ...f.thresholds].forEach(add);
  return out;
}

const FORBIDDEN = /solltest|musst|müssen|zu viel|zu wenig|schlecht|diät|abnehm|zunehm|gewicht|fehler|verboten/i;

// "2.412" (Tausenderpunkt) und "7,5" (Komma) wie im Deutschen lesen.
function numbersIn(text) {
  return (text.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g) ?? []).map((s) => Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')));
}

export function checkHint(text, allowed) {
  if (typeof text !== 'string' || !text.trim() || FORBIDDEN.test(text)) return false;
  return numbersIn(text).every((n) => [...allowed].some((a) => Math.abs(a - n) < 1e-9));
}

const UNIT_TEXT = { kcal: 'kcal', g: 'g', h: 'h', bpm: 'Schläge pro Minute' };

// Ohne Gemini oder wenn kein Hinweis die Prüfung besteht: schlichte Sätze aus den Zahlen.
export function fallbackSentences(findings) {
  return findings.map((f) => {
    const u = UNIT_TEXT[f.unit];
    return `${f.text}: ${f.a.label} Ø ${fmt(f.a.mean, DIGITS[f.unit])} ${u}, ${f.b.label} Ø ${fmt(f.b.mean, DIGITS[f.unit])} ${u} (${f.a.n} und ${f.b.n} Tage).`;
  });
}
