// Reine Logik für Tagesnavigation, Wochenübersicht, Gewichts-Schnitt und "Zuletzt gegessen".

// 'YYYY-MM-DD' + n Kalendertage. Rechnet in UTC, damit Zeitumstellungen nichts verschieben.
export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x) => String(x).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

// days: [{dateKey, kcal, meals}] – nur Tage mit Einträgen (meals > 0) zählen.
export function weekSummary(days, goal) {
  const logged = days.filter((d) => d.meals > 0);
  if (!logged.length) return { avgKcal: null, loggedDays: 0, daysInGoal: 0 };
  const total = logged.reduce((s, d) => s + d.kcal, 0);
  return {
    avgKcal: Math.round(total / logged.length),
    loggedDays: logged.length,
    daysInGoal: goal ? logged.filter((d) => d.kcal <= goal).length : 0,
  };
}

// Gleitender Schnitt: pro Eintrag der Mittelwert aller Einträge der letzten `days` Tage (inkl. des Tages selbst).
// weights muss nach Datum aufsteigend sortiert sein.
export function rollingAverage(weights, days = 7) {
  return weights.map((w) => {
    const from = addDays(w.date, -days);
    const inWindow = weights.filter((x) => x.date > from && x.date <= w.date);
    const avg = inWindow.reduce((s, x) => s + x.kg, 0) / inWindow.length;
    return { date: w.date, kg: Math.round(avg * 10) / 10 };
  });
}

// Die zuletzt gegessenen, unterschiedlichen Produkte (neueste Mahlzeit je Produkt), neueste zuerst.
export function pickRecent(meals, limit = 6) {
  const sorted = [...meals].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const seen = new Set();
  const out = [];
  for (const m of sorted) {
    const key = m.productId != null ? `p${m.productId}` : `n${m.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

const dayNumber = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Lineare Regression über die letzten 28 Tage. null, wenn zu wenig Daten (min. minN Einträge, min. minSpan Tage Abstand).
// slope: kg pro Tag, current: gefitteter Wert beim letzten Eintrag.
function fitTrend(weights, { minN = 3, minSpan = 7 } = {}) {
  const all = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (!all.length) return null;
  const latest = all.at(-1);
  const from = addDays(latest.date, -28);
  const win = all.filter((w) => w.date > from);
  const x0 = dayNumber(win[0].date);
  const xs = win.map((w) => dayNumber(w.date) - x0);
  if (win.length < minN || xs.at(-1) < minSpan) return null;

  const n = win.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = win.reduce((s, w) => s + w.kg, 0) / n;
  const sxx = xs.reduce((s, v) => s + (v - mx) ** 2, 0);
  const sxy = xs.reduce((s, v, i) => s + (v - mx) * (win[i].kg - my), 0);
  const slope = sxy / sxx;
  return { slope, current: my + slope * (xs.at(-1) - mx), latestDate: latest.date };
}

// Grobe Prognose, wann das Zielgewicht erreicht wird.
// status: nodata | reached | flat | wrongway | far (> 2 Jahre) | ok (mit date, perWeek in kg)
export function forecast(weights, target) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return { status: 'nodata' };
  const latest = sorted.at(-1);
  if (Math.abs(latest.kg - target) <= 0.3) return { status: 'reached' };

  const t = fitTrend(sorted);
  if (!t) return { status: 'nodata' };
  const diff = target - t.current;
  if (Math.abs(t.slope) < 0.005) return { status: 'flat' };
  if (Math.sign(t.slope) !== Math.sign(diff)) return { status: 'wrongway' };
  const days = Math.round(diff / t.slope);
  if (days > 730) return { status: 'far' };
  return { status: 'ok', date: addDays(t.latestDate, days), days, perWeek: Math.round(t.slope * 7 * 10) / 10 };
}

// Warnt, wenn der Gewichtstrend schneller als 1 % des Körpergewichts pro Woche fällt (min. 4 Einträge über >= 10 Tage).
export function fastLossWarning(weights) {
  const t = fitTrend(weights, { minN: 4, minSpan: 10 });
  if (!t) return null;
  const perWeek = t.slope * 7;
  if (perWeek > -0.01 * t.current) return null;
  return { perWeekKg: Math.round(perWeek * 10) / 10, percent: Math.round((-perWeek / t.current) * 1000) / 10 };
}
