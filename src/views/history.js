import { el, mount } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { addDays, weekSummary } from '../overview.js';
import { yearGrid } from '../calendar.js';
import { shiftWeek } from '../week.js';
import { trackingDays, streak } from '../pet.js';
import { mealsForDate, getSettings, listMeals, listDayStatuses, setDayStatus, listWorkouts, listExercises, listWeights } from '../db.js';
import { MUSCLES, personalRecords, muscleDistribution, weeklySetSeries, strengthCurve, daysSinceMuscle } from '../training.js';
import { openWorkout } from './workout.js';
import { showView } from '../nav.js';
import { setViewedDateKey, dayLabel, dayHeading } from '../state.js';
import { weekStrip } from './week-strip.js';

const BAR_AREA = 80; // px Höhe für Balken in der Wochenansicht

let selected = null; // im Verlauf gewählter Tag; null = heute
let curveExercise = null; // gewählte Übung im Kraft-Diagramm

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
  const [settings, weekMeals, everyMeal, dayStatuses, workouts, exercises, weights] = await Promise.all([
    getSettings(),
    Promise.all(weekKeys.map((k) => mealsForDate(k))),
    listMeals(),
    listDayStatuses(),
    listWorkouts(),
    listExercises(),
    listWeights(),
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
    dayCard({ day, meals: dayMeals, status: statuses[day] ?? null, workouts: workouts.filter((w) => w.dateKey === day) }),
    yearCard({ counts, statuses, todayKey, stk: streak(trackedDays, todayKey, sickDays), total: trackedDays.length }),
    el('h2', {}, 'Letzte 7 Tage'),
    weekCard(days, settings.calorieGoal, day),
    el('h2', {}, 'Fortschritt'),
    ...progressCards({ workouts, exercises, weights, todayKey }));
  const heat = root.querySelector('.heat-scroll');
  if (heat) heat.scrollLeft = heat.scrollWidth; // neueste Wochen rechts sichtbar
}

function dayCard({ day, meals, status, workouts }) {
  const kcal = dayTotals(meals).kcal;
  const toggle = (value, label) => el('button', {
    type: 'button', class: `chipbtn${status === value ? ' on' : ''}`, 'aria-pressed': status === value ? 'true' : 'false',
    onClick: async () => { await setDayStatus(day, status === value ? null : value); renderHistory(); },
  }, label);
  return el('div', { class: 'card' },
    el('div', { class: 'row' },
      el('div', {},
        el('b', {}, dayHeading(day)),
        el('div', { class: 'muted' }, meals.length ? `${meals.length} ${meals.length === 1 ? 'Eintrag' : 'Einträge'} · ${kcal} kcal` : 'Keine Einträge')),
      el('button', { class: 'small ghost', onClick: () => openDay(day) }, 'Ansehen')),
    workouts.length ? el('div', { style: 'margin-top:10px' }, ...workouts.map((w) => el('div', {}, el('b', {}, w.title), el('span', { class: 'muted' }, `${w.durationMin ? ` · ${w.durationMin} min` : ''} · ${w.sets.length} ${w.sets.length === 1 ? 'Satz' : 'Sätze'}`)))) : null,
    el('div', { class: 'quick', style: 'margin-top:12px' }, toggle('rest', 'Ruhetag'), toggle('sick', 'Krank')),
    el('button', { class: 'btn', style: 'width:100%;margin-top:8px', onClick: () => openWorkout({ dateKey: day }) }, 'Training nachtragen'),
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

// ---------- Fortschritt ----------
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, text = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const de1 = (n) => String(n).replace('.', ',');
const invite = (text) => el('div', { class: 'muted' }, text);

function progressCards({ workouts, exercises, weights, todayKey }) {
  const last = weights.at(-1);
  const records = personalRecords(workouts, exercises).slice(0, 3);
  const dist = muscleDistribution(workouts, exercises, todayKey);
  const since = MUSCLES.map((m) => [m, daysSinceMuscle(workouts, exercises, m, todayKey)]).filter(([, d]) => d != null).sort((a, b) => b[1] - a[1])[0];
  const series = weeklySetSeries(workouts, todayKey);
  const withCurve = exercises.map((e) => ({ e, points: strengthCurve(workouts, e.id) })).filter((x) => x.points.length).sort((a, b) => b.points.length - a.points.length);
  const chosen = withCurve.find((x) => x.e.id === curveExercise) ?? withCurve[0] ?? null;

  return [
    el('div', { class: 'card' },
      el('div', { class: 'row' },
        el('div', {}, el('b', {}, 'Gewicht'),
          last ? el('div', { class: 'muted' }, `${de1(last.kg)} kg am ${new Date(last.date + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`) : invite('Noch kein Gewicht. Trag dein erstes ein.')),
        el('button', { class: 'small ghost', onClick: () => showView('weight') }, 'Eintragen'))),
    el('div', { class: 'card' },
      el('b', {}, 'Rekorde'),
      records.length
        ? el('div', { style: 'margin-top:8px' }, ...records.map((r) => el('div', { class: 'row', style: 'margin-bottom:6px' },
            el('span', {}, r.name, el('span', { class: 'muted' }, ` · ${r.bestKg > 0 ? de1(r.bestKg) : 'KG'} × ${r.bestReps}`)),
            el('span', { class: 'mk' }, `≈ ${de1(r.best1RM)}`, el('small', {}, 'kg')))))
        : invite('Noch keine Rekorde. Dein erstes Training legt die Basis.')),
    el('div', { class: 'card' },
      el('b', {}, 'Muskelverteilung (30 Tage)'),
      dist.length
        ? el('div', { style: 'margin-top:8px' }, ...dist.map((d) => el('div', { class: 'mdist' },
            el('span', {}, d.muscle), el('div', { class: 'mbar' }, el('i', { style: `width:${d.percent}%` })), el('b', {}, `${d.percent} %`))),
            since ? el('div', { class: 'muted', style: 'margin-top:6px' }, `${since[0]} zuletzt ${since[1] === 0 ? 'heute' : since[1] === 1 ? 'vor 1 Tag' : `vor ${since[1]} Tagen`}`) : null)
        : invite('Sobald du trainierst, siehst du hier, welche Muskeln du bearbeitet hast.')),
    el('div', { class: 'card' },
      el('b', {}, 'Sätze pro Woche'),
      series.some((s) => s.sets) ? weeklyBars(series) : invite('Hier erscheinen deine Sätze der letzten 8 Wochen.')),
    el('div', { class: 'card' },
      el('b', {}, 'Kraft pro Übung'),
      chosen
        ? el('div', {},
            el('div', { class: 'chips', style: 'margin:8px -16px 8px' }, ...withCurve.map((x) => el('button', {
              class: x.e.id === chosen.e.id ? 'on' : '', 'aria-pressed': x.e.id === chosen.e.id ? 'true' : 'false', onClick: () => { curveExercise = x.e.id; renderHistory(); },
            }, el('b', {}, x.e.name)))),
            curveChart(chosen.points),
            el('div', { class: 'muted' }, 'Geschätztes Maximum für eine Wiederholung.'))
        : invite('Nach deinen ersten Sätzen siehst du hier die Entwicklung je Übung.')),
  ];
}

function weeklyBars(series) {
  const max = Math.max(...series.map((s) => s.sets), 1);
  return el('div', { class: 'sbars' }, ...series.map((s) => {
    const [, m, d] = s.weekStart.split('-');
    return el('div', { class: 'sbar', 'aria-label': `Woche ab ${Number(d)}.${Number(m)}.: ${s.sets} Sätze` },
      el('span', {}, String(s.sets)), el('i', { style: `height:${Math.max(3, (s.sets / max) * 70)}px` }), el('small', {}, `${Number(d)}.${Number(m)}.`));
  }));
}

function curveChart(points) {
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  const vals = points.map((p) => p.best1RM);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) { lo -= 5; hi += 5; }
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curve', role: 'img', 'aria-label': 'Kraftverlauf' });
  svg.append(
    sv('text', { x: 2, y: pad.t + 4, class: 'ct' }, de1(Math.round(hi))),
    sv('text', { x: 2, y: H - pad.b, class: 'ct' }, de1(Math.round(lo))),
    sv('polyline', { points: points.map((p, i) => `${x(i)},${y(p.best1RM)}`).join(' '), fill: 'none', stroke: '#f2711c', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    ...points.map((p, i) => sv('circle', { cx: x(i), cy: y(p.best1RM), r: 4, fill: '#f2711c' })),
    sv('text', { x: pad.l, y: H - 4, class: 'ct' }, points[0].dateKey.slice(5).split('-').reverse().map(Number).join('.') + '.'),
    sv('text', { x: W - pad.r, y: H - 4, class: 'ct', 'text-anchor': 'end' }, points.at(-1).dateKey.slice(5).split('-').reverse().map(Number).join('.') + '.'));
  return svg;
}
