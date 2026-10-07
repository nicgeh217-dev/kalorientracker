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

// Grobe Prognose, wann das Zielgewicht erreicht wird: lineare Regression über die letzten 28 Tage.
// status: nodata | reached | flat | wrongway | far (> 2 Jahre) | ok (mit date, perWeek in kg)
export function forecast(weights, target) {
  const all = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (!all.length) return { status: 'nodata' };
  const latest = all.at(-1);
  if (Math.abs(latest.kg - target) <= 0.3) return { status: 'reached' };

  const from = addDays(latest.date, -28);
  const win = all.filter((w) => w.date > from);
  const x0 = dayNumber(win[0].date);
  const xs = win.map((w) => dayNumber(w.date) - x0);
  if (win.length < 3 || xs.at(-1) < 7) return { status: 'nodata' };

  const n = win.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = win.reduce((s, w) => s + w.kg, 0) / n;
  const sxx = xs.reduce((s, v) => s + (v - mx) ** 2, 0);
  const sxy = xs.reduce((s, v, i) => s + (v - mx) * (win[i].kg - my), 0);
  const slope = sxy / sxx; // kg pro Tag
  const current = my + slope * (xs.at(-1) - mx);
  const diff = target - current;

  if (Math.abs(slope) < 0.005) return { status: 'flat' };
  if (Math.sign(slope) !== Math.sign(diff)) return { status: 'wrongway' };
  const days = Math.round(diff / slope);
  if (days > 730) return { status: 'far' };
  return { status: 'ok', date: addDays(latest.date, days), days, perWeek: Math.round(slope * 7 * 10) / 10 };
}
