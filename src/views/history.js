import { el, mount } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { addDays, weekSummary } from '../overview.js';
import { monthGrid, shiftMonth } from '../calendar.js';
import { mealsForDate, getSettings, listMeals, listWeights } from '../db.js';
import { showView } from '../nav.js';
import { setViewedDateKey, viewedDateKey, dayLabel } from '../state.js';

const BAR_AREA = 80; // px Höhe für Balken in der Wochenansicht
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

let calMonth = null; // angezeigter Kalendermonat {year, month}; null = aktueller Monat

// Springt zu einem Tag auf "Heute".
function openDay(dateKey) {
  setViewedDateKey(dateKey);
  showView('today');
  window.scrollTo({ top: 0 });
}

export async function renderHistory() {
  const root = document.getElementById('view-history');
  const todayKey = localDateKey(new Date());
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(todayKey, i - 6));
  const [settings, weekMeals, everyMeal, weights] = await Promise.all([
    getSettings(),
    Promise.all(weekKeys.map((k) => mealsForDate(k))),
    listMeals(),
    listWeights(),
  ]);
  const days = weekKeys.map((k, i) => ({ dateKey: k, kcal: dayTotals(weekMeals[i]).kcal, meals: weekMeals[i].length }));

  mount(root,
    el('h1', {}, 'Verlauf'),
    el('h2', {}, 'Letzte 7 Tage'),
    weekCard(days, settings.calorieGoal, viewedDateKey()),
    el('h2', {}, 'Kalender'),
    calendarCard({ everyMeal, weights, todayKey, selected: viewedDateKey() }));
}

function weekCard(days, goal, selected) {
  const s = weekSummary(days, goal);
  const maxVal = Math.max(goal || 0, ...days.map((d) => d.kcal), 1);
  const bars = el('div', { class: 'bars' },
    goal ? el('div', { class: 'goalline', style: `bottom:${22 + (goal / maxVal) * BAR_AREA}px` }) : null,
    ...days.map((d) => {
      const [y, m, dd] = d.dateKey.split('-').map(Number);
      const wd = new Date(y, m - 1, dd).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
      const cls = [d.meals ? 'has' : '', goal && d.kcal > goal ? 'over' : '', d.dateKey === selected ? 'sel' : ''].join(' ').trim();
      return el('button', { class: cls, 'aria-label': `${dayLabel(d.dateKey)}: ${d.kcal} kcal`, onClick: () => openDay(d.dateKey) },
        el('i', { style: `height:${Math.max(4, (d.kcal / maxVal) * BAR_AREA)}px` }), wd);
    }));
  return el('div', { class: 'card' },
    el('div', { class: 'week-stats' },
      el('div', {}, el('div', { class: 'num' }, s.avgKcal == null ? '–' : String(s.avgKcal)), el('div', { class: 'lbl' }, 'Ø kcal pro Tag')),
      goal ? el('div', {}, el('div', { class: 'num' }, `${s.daysInGoal}/${s.loggedDays}`), el('div', { class: 'lbl' }, 'Tage im Ziel')) : null),
    bars,
    el('div', { class: 'legend' },
      el('span', {}, 'Der Schnitt zählt nur Tage mit Einträgen.'),
      goal ? el('span', {}, '- - Ziel') : null));
}

// Heatmap: welche Tage hast du eingetragen? Die Farbe zeigt nur die Anzahl der Einträge, nicht Kalorien.
function calendarCard({ everyMeal, weights, todayKey, selected }) {
  const counts = {};
  for (const m of everyMeal) counts[m.dateKey] = (counts[m.dateKey] ?? 0) + 1;
  const todayMonth = { year: Number(todayKey.slice(0, 4)), month: Number(todayKey.slice(5, 7)) };
  const cal = calMonth ?? todayMonth;
  const g = monthGrid({ year: cal.year, month: cal.month, counts, weightDays: new Set(weights.map((w) => w.date)), todayKey });
  const label = new Date(cal.year, cal.month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const isCurrent = cal.year === todayMonth.year && cal.month === todayMonth.month;
  const move = (delta) => { calMonth = shiftMonth(cal, delta); renderHistory(); };

  const cell = (c) => el('button', {
    class: `cal-day lv${c.level}${c.isToday ? ' today' : ''}${c.dateKey === selected ? ' sel' : ''}${c.isFuture ? ' future' : ''}`,
    disabled: c.isFuture,
    'aria-label': `${c.day}. ${label}: ${c.count} ${c.count === 1 ? 'Eintrag' : 'Einträge'}${c.weight ? ', Gewicht eingetragen' : ''}`,
    onClick: () => openDay(c.dateKey),
  }, String(c.day), c.weight ? el('span', { class: 'wdot' }) : null);

  return el('div', { class: 'card cal' },
    el('div', { class: 'row' },
      el('b', {}, label),
      el('div', { class: 'xrow' },
        el('button', { class: 'x', 'aria-label': 'Vorheriger Monat', onClick: () => move(-1) }, '‹'),
        el('button', { class: 'x', 'aria-label': 'Nächster Monat', disabled: isCurrent, onClick: () => move(1) }, '›'))),
    el('div', { class: 'cal-grid cal-head' }, ...WEEKDAYS.map((d) => el('span', {}, d))),
    ...g.weeks.map((week) => el('div', { class: 'cal-grid' }, ...week.map((c) => (c ? cell(c) : el('span', { class: 'cal-empty' }))))),
    el('div', { class: 'muted', style: 'margin-top:10px' }, `${g.tracked} von ${g.elapsed} Tagen mit Einträgen. Je kräftiger die Farbe, desto mehr Einträge. Blauer Punkt: Gewicht eingetragen.`));
}
