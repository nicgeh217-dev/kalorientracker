import { el, mount } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { addDays, weekSummary } from '../overview.js';
import { yearGrid } from '../calendar.js';
import { shiftWeek } from '../week.js';
import { trackingDays, streak } from '../pet.js';
import { mealsForDate, getSettings, listMeals, listDayStatuses, setDayStatus } from '../db.js';
import { showView } from '../nav.js';
import { setViewedDateKey, dayLabel, longDate } from '../state.js';
import { weekStrip } from './week-strip.js';

const BAR_AREA = 80; // px Höhe für Balken in der Wochenansicht

let selected = null; // im Verlauf gewählter Tag; null = heute

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
  const [settings, weekMeals, everyMeal, dayStatuses] = await Promise.all([
    getSettings(),
    Promise.all(weekKeys.map((k) => mealsForDate(k))),
    listMeals(),
    listDayStatuses(),
  ]);
  const days = weekKeys.map((k, i) => ({ dateKey: k, kcal: dayTotals(weekMeals[i]).kcal, meals: weekMeals[i].length }));
  const counts = {};
  for (const m of everyMeal) counts[m.dateKey] = (counts[m.dateKey] ?? 0) + 1;
  const statuses = Object.fromEntries(dayStatuses.map((d) => [d.dateKey, d.status]));
  const sickDays = dayStatuses.filter((d) => d.status === 'sick').map((d) => d.dateKey);
  const day = selected && selected <= todayKey ? selected : todayKey;
  const dayMeals = everyMeal.filter((m) => m.dateKey === day);
  const trackedDays = trackingDays(everyMeal);

  const pick = (key) => { selected = key; renderHistory(); };
  const shift = (n) => { const next = shiftWeek(day, n); pick(next > todayKey ? todayKey : next); };

  mount(root,
    el('h1', {}, 'Verlauf'),
    weekStrip({ selected: day, todayKey, counts, statuses, onSelect: pick, onShift: shift }),
    dayCard({ day, meals: dayMeals, status: statuses[day] ?? null }),
    yearCard({ counts, statuses, todayKey, stk: streak(trackedDays, todayKey, sickDays), total: trackedDays.length }),
    el('h2', {}, 'Letzte 7 Tage'),
    weekCard(days, settings.calorieGoal, day));
  const heat = root.querySelector('.heat-scroll');
  if (heat) heat.scrollLeft = heat.scrollWidth; // neueste Wochen rechts sichtbar
}

function dayCard({ day, meals, status }) {
  const kcal = dayTotals(meals).kcal;
  const toggle = (value, label) => el('button', {
    type: 'button', class: `chipbtn${status === value ? ' on' : ''}`, 'aria-pressed': status === value ? 'true' : 'false',
    onClick: async () => { await setDayStatus(day, status === value ? null : value); renderHistory(); },
  }, label);
  return el('div', { class: 'card' },
    el('div', { class: 'row' },
      el('div', {},
        el('b', {}, `${dayLabel(day)}, ${longDate(day)}`),
        el('div', { class: 'muted' }, meals.length ? `${meals.length} ${meals.length === 1 ? 'Eintrag' : 'Einträge'} · ${kcal} kcal` : 'Keine Einträge')),
      el('button', { class: 'small ghost', onClick: () => openDay(day) }, 'Ansehen')),
    el('div', { class: 'quick', style: 'margin-top:12px' }, toggle('rest', 'Ruhetag'), toggle('sick', 'Krank')),
    el('div', { class: 'muted', style: 'margin-top:8px' }, 'Ein Krankheitstag unterbricht deine Serie nicht. Ruhetage betreffen nur das Training.'));
}

// Heatmap: welche Tage hast du eingetragen? Die Farbe zeigt nur die Anzahl der Einträge, nicht Kalorien.
function yearCard({ counts, statuses, todayKey, stk, total }) {
  const g = yearGrid({ counts, statuses, todayKey });
  const cell = (c) => el('i', {
    class: `hcell lv${c.level}${c.status ? ` ${c.status}` : ''}${c.isFuture ? ' future' : ''}${c.isToday ? ' today' : ''}`,
  });
  const stat = (n, label) => el('div', {}, el('div', { class: 'num' }, String(n)), el('div', { class: 'muted' }, label));
  return el('div', { class: 'card' },
    el('h2', { style: 'margin:0 0 10px' }, 'Dein Jahr'),
    el('div', { class: 'week-stats' }, stat(stk.current, stk.current === 1 ? 'Tag in Folge' : 'Tage in Folge'), stat(stk.best, 'Rekord'), stat(total, 'Tage insgesamt')),
    el('div', { class: 'heat-scroll', role: 'img', 'aria-label': `Jahresübersicht: ${g.tracked} Tage mit Einträgen` },
      el('div', { class: 'heat' }, ...g.weeks.map((w) => el('div', { class: 'hweek' }, ...w.map(cell))))),
    el('div', { class: 'legend' },
      el('span', {}, 'Je kräftiger die Farbe, desto mehr Einträge.'),
      el('span', {}, '● krank'), el('span', {}, '✓ Ruhetag')));
}

function weekCard(days, goal, selectedDay) {
  const s = weekSummary(days, goal);
  const maxVal = Math.max(goal || 0, ...days.map((d) => d.kcal), 1);
  const bars = el('div', { class: 'bars' },
    goal ? el('div', { class: 'goalline', style: `bottom:${22 + (goal / maxVal) * BAR_AREA}px` }) : null,
    ...days.map((d) => {
      const [y, m, dd] = d.dateKey.split('-').map(Number);
      const wd = new Date(y, m - 1, dd).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
      const cls = [d.meals ? 'has' : '', goal && d.kcal > goal ? 'over' : '', d.dateKey === selectedDay ? 'sel' : ''].join(' ').trim();
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
