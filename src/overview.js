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
