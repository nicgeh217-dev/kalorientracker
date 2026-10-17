import { el, toast, mount } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { suggestAdjustment, currentAge } from '../calorie.js';
import { fastLossCard } from './notes.js';
import { backupReminder } from '../backup.js';
import { trackingDays, streak, petLevel, nextLevelAt, accessoriesFor, newUnlocks, petMood, petMessage, daysBetween } from '../pet.js';
import { foxSvg } from './fox.js';
import { openPetIntro, openPetSheet } from './pet-sheet.js';
import { monthGrid, shiftMonth } from '../calendar.js';
import { shareBackup } from '../backup-share.js';
import { addDays, weekSummary, pickRecent, rollingAverage, fastLossWarning } from '../overview.js';
import { mealsForDate, deleteMeal, getSettings, addMeal, listMeals, getProduct, listQueued, deleteQueued, listWeights, saveSettings } from '../db.js';
import { showView } from '../nav.js';
import { viewedDateKey, isViewingToday, setViewedDateKey, dayLabel, longDate, timestampFor } from '../state.js';
import { openMealForm } from './meal-form.js';
import { runQueued } from './scan.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

const R = 92;
const CIRC = 2 * Math.PI * R;
const BAR_AREA = 80; // px Höhe für Balken in der Wochenansicht

function ring(progress) {
  const s = svg('svg', { viewBox: '0 0 220 220', 'aria-hidden': 'true' });
  const defs = svg('defs');
  const g = svg('linearGradient', { id: 'ringGrad', x1: '0', y1: '0', x2: '1', y2: '1' });
  g.append(svg('stop', { offset: '0', 'stop-color': '#fc4c02' }), svg('stop', { offset: '1', 'stop-color': '#ff8a3d' }));
  defs.append(g);
  const track = svg('circle', { class: 'track', cx: 110, cy: 110, r: R });
  const fg = svg('circle', { class: 'fg', cx: 110, cy: 110, r: R, 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC });
  s.append(defs, track, fg);
  // Beim ersten Zeichnen füllt sich der Ring von 0 aus.
  requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', CIRC * (1 - progress))));
  return s;
}

function go(dateKey) {
  setViewedDateKey(dateKey);
  return renderToday();
}

let queueUrls = [];
let prevTodayCount = null; // für die Kau-Animation, wenn gerade ein Eintrag dazukam
let introOpen = false;
let calMonth = null; // angezeigter Kalendermonat {year, month}; null = aktueller Monat
let celebratedLevel = null;

export async function renderToday() {
  const root = document.getElementById('view-today');
  for (const u of queueUrls) URL.revokeObjectURL(u);
  queueUrls = [];
  const dateKey = viewedDateKey();
  const isToday = isViewingToday();
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(dateKey, i - 6));
  const [settings, weekMeals, everyMeal, queued, weights] = await Promise.all([
    getSettings(),
    Promise.all(weekKeys.map((k) => mealsForDate(k))),
    listMeals(),
    listQueued(),
    listWeights(),
  ]);
  const meals = weekMeals[6];
  const todayKey = localDateKey(new Date());
  const t = dayTotals(meals);
  const goal = settings.calorieGoal;
  const progress = goal ? Math.min(1, t.kcal / goal) : 0;
  const over = goal && t.kcal > goal;
  const centerNum = goal ? Math.abs(goal - t.kcal) : t.kcal;
  const centerUnit = goal ? (over ? 'kcal drüber' : 'kcal übrig') : 'kcal gegessen';
  const macroKcal = { p: t.protein * 4, c: t.carbs * 4, f: t.fat * 9 };

  const weekDays = weekKeys.map((k, i) => ({ dateKey: k, kcal: dayTotals(weekMeals[i]).kcal, meals: weekMeals[i].length }));
  const recent = pickRecent(everyMeal, 6);

  // Kalorienrechner: Vorschlag (nur mit Bestätigung) und Warnung bei zu schneller Abnahme
  const lastW = weights.at(-1);
  const avgW = lastW && lastW.date >= addDays(localDateKey(new Date()), -14) ? rollingAverage(weights, 7).at(-1).kg : null;
  const suggestion = isToday ? suggestAdjustment({ settings, avgWeightKg: avgW }) : null;
  const fastLoss = isToday ? fastLossWarning(weights) : null;
  // Fuchs-Begleiter (alles aus den Einträgen abgeleitet)
  const petDays = trackingDays(everyMeal);
  const petStreak = streak(petDays, todayKey);
  const petTotal = petDays.length;
  const petLvl = petLevel(petTotal);
  const todayCount = everyMeal.filter((m) => m.dateKey === todayKey).length;
  const munch = isToday && prevTodayCount != null && todayCount > prevTodayCount;
  if (isToday) prevTodayCount = todayCount;
  const petCfg = settings.pet;
  let petNode = null;
  if (isToday && !petCfg && !introOpen && !document.querySelector('.sheet')) {
    introOpen = true;
    openPetIntro(petLvl);
  } else if (isToday && petCfg && petCfg.enabled !== false) {
    petNode = petCard({
      cfg: petCfg, level: petLvl, total: petTotal, streak: petStreak, todayCount, munch, todayKey,
      daysSinceLast: petDays.length ? daysBetween(petDays.at(-1), todayKey) : null,
      weightToday: weights.some((w) => w.date === todayKey),
    });
    const fresh = newUnlocks(petLvl, petCfg.seenLevel ?? petLvl);
    if (fresh.length && celebratedLevel !== petLvl) {
      celebratedLevel = petLvl;
      saveSettings({ ...settings, pet: { ...petCfg, seenLevel: petLvl } });
      toast(`${petCfg.name} hat etwas Neues: ${fresh.map((a) => a.label).join(', ')}!`);
    }
  }
  const dataDates = [...everyMeal.map((m) => m.dateKey), ...weights.map((w) => w.date)].sort();
  const reminder = isToday ? backupReminder({
    lastBackupAt: settings.lastBackupAt, snoozedUntil: settings.backupSnoozedUntil,
    firstDataDate: dataDates[0] ?? null, lastDataDate: dataDates.at(-1) ?? null,
  }) : null;

  mount(root,
    el('div', { class: 'dayhead' },
      el('div', {}, el('div', { class: 'eyebrow' }, longDate(dateKey)), el('h1', {}, dayLabel(dateKey))),
      el('div', { class: 'daynav' },
        el('button', { 'aria-label': 'Vorheriger Tag', onClick: () => go(addDays(dateKey, -1)) }, '‹'),
        el('button', { 'aria-label': 'Nächster Tag', disabled: isToday, onClick: () => go(addDays(dateKey, 1)) }, '›'))),
    petNode,
    el('div', { class: 'card hero' },
      el('div', { class: `ring${over ? ' over' : ''}` },
        ring(progress),
        el('div', { class: 'center' },
          el('div', { class: 'num' }, String(centerNum)),
          el('div', { class: 'unit' }, centerUnit))),
      goal
        ? el('div', { class: 'hero-meta' },
            el('div', {}, el('b', {}, String(t.kcal)), 'Gegessen'),
            el('div', {}, el('b', {}, String(goal)), 'Ziel'))
        : el('div', { class: 'note warn', style: 'margin-bottom:0' }, 'Noch kein Kalorienziel. ',
            el('a', { href: '#', onClick: (e) => { e.preventDefault(); showView('settings'); } }, 'In den Einstellungen eintragen'))),
    suggestion ? suggestionCard(suggestion, settings) : null,
    fastLossCard(fastLoss),
    reminder ? backupCard(reminder) : null,
    el('div', { class: 'card' },
      el('div', { class: 'macros' },
        macro('Protein', t.protein, 'var(--p)'),
        macro('Kohlenhydr.', t.carbs, 'var(--c)'),
        macro('Fett', t.fat, 'var(--f)')),
      el('div', { class: 'split', 'aria-hidden': 'true' },
        el('i', { style: `flex-grow:${macroKcal.p};background:var(--p)` }),
        el('i', { style: `flex-grow:${macroKcal.c};background:var(--c)` }),
        el('i', { style: `flex-grow:${macroKcal.f};background:var(--f)` })),
      settings.proteinGoal ? proteinGoalRow(t.protein, settings.proteinGoal) : null),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: () => openMealForm(null) }, 'Manuell eintragen'),
      el('button', { class: 'btn', onClick: () => showView('products') }, 'Aus Produkten')),
    queued.length ? el('h2', {}, 'Wartet auf Auswertung') : null,
    ...queued.map(queueCard),
    recent.length ? el('h2', {}, 'Zuletzt gegessen') : null,
    recent.length ? el('div', { class: 'chips' }, ...recent.map((m) => recentChip(m, dateKey))) : null,
    el('h2', {}, 'Mahlzeiten'),
    ...(meals.length
      ? [...meals].reverse().map(mealCard)
      : [el('div', { class: 'card muted' }, isToday
          ? 'Noch nichts eingetragen. Tippe auf die Kamera, um ein Etikett zu scannen.'
          : 'Für diesen Tag ist nichts eingetragen. Du kannst es mit den Buttons oben nachtragen.')]),
    el('h2', {}, 'Letzte 7 Tage'),
    weekCard(weekDays, goal, dateKey),
    el('h2', {}, 'Kalender'),
    calendarCard({ everyMeal, weights, todayKey, selected: dateKey }));
}

function macro(label, grams, color) {
  return el('div', { class: 'macro' },
    el('div', { class: 'lbl' }, el('span', { class: 'dot', style: `background:${color}` }), label),
    el('div', { class: 'num' }, String(grams), el('small', {}, 'g')));
}

function recentChip(m, dateKey) {
  return el('button', {
    onClick: async () => {
      const id = await addMeal({
        timestamp: timestampFor(dateKey), dateKey, productId: m.productId, name: m.name, amount: m.amount,
        kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
        ...(m.estimated ? { estimated: true } : {}),
      });
      toast(`${m.name} eingetragen`, 'Rückgängig', async () => { await deleteMeal(id); renderToday(); });
      renderToday();
    },
  }, el('b', {}, m.name), el('span', {}, `${m.kcal} kcal`));
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
      return el('button', { class: cls, 'aria-label': `${dayLabel(d.dateKey)}: ${d.kcal} kcal`, onClick: () => go(d.dateKey) },
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

async function editMeal(m) {
  const product = m.productId != null ? await getProduct(m.productId) : null;
  const prefill = product
    ? { ...product, productId: product.id, amount: m.amount }
    : { name: m.name, basis: 'perServing', servingGrams: null, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, amount: { unit: 'servings', value: 1 } };
  openMealForm(prefill, { meal: m });
}

function mealCard(m, i) {
  const time = new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const amt = m.amount ? ` · ${m.amount.value} ${m.amount.unit === 'g' ? 'g' : '×'}` : '';
  return el('div', { class: 'card meal', style: `--i:${i}` },
    el('div', { class: 'meal-top' },
      el('div', {}, el('strong', {}, m.name), el('div', { class: 'muted' }, `${time}${amt}`)),
      el('div', { class: 'xrow' },
        el('button', { class: 'x', 'aria-label': `${m.name} bearbeiten`, onClick: () => editMeal(m) }, '✎'),
        el('button', {
          class: 'x',
          'aria-label': `${m.name} löschen`,
          onClick: async () => {
            if (confirm(`"${m.name}" löschen?`)) {
              await deleteMeal(m.id);
              renderToday();
            }
          },
        }, '×'))),
    el('div', { class: 'meal-stats' },
      el('div', { class: 'num kcal' }, `${m.estimated ? '~' : ''}${m.kcal}`, el('small', {}, 'kcal')),
      m.estimated ? el('span', { class: 'tag' }, 'Schätzung') : null,
      mini('Protein', m.protein), mini('KH', m.carbs), mini('Fett', m.fat)));
}

function mini(label, v) {
  return el('div', { class: 'mini' }, el('b', {}, v == null ? '–' : String(v)), el('span', {}, label));
}

function proteinGoalRow(protein, goal) {
  const pct = Math.min(100, Math.round((protein / goal) * 100));
  const reached = protein >= goal;
  return el('div', { class: 'pgoal' },
    el('div', { class: 'row' },
      el('span', { class: 'muted' }, reached ? 'Proteinziel erreicht' : 'Proteinziel'),
      el('b', {}, `${protein} / ${goal} g`)),
    el('div', { class: 'pbar', role: 'progressbar', 'aria-valuenow': protein, 'aria-valuemax': goal }, el('div', { style: `width:${pct}%` })));
}

function queueCard(item) {
  const url = item.blobs[0] ? URL.createObjectURL(item.blobs[0]) : null;
  if (url) queueUrls.push(url);
  const n = item.blobs.length;
  const what = n ? `${n} Foto${n > 1 ? 's' : ''}` : 'Beschreibung';
  const offline = navigator.onLine === false;
  return el('div', { class: 'card qrow' },
    url ? el('img', { src: url, alt: '' }) : el('div', { class: 'qph' }, '✎'),
    el('div', { class: 'qtxt' },
      el('strong', {}, item.hint ? item.hint : what),
      el('div', { class: 'muted' }, `${what} · für ${dayLabel(item.dateKey)}${offline ? ' · offline' : ''}`)),
    el('div', { class: 'xrow' },
      el('button', { class: 'small primary', disabled: offline, onClick: () => runQueued(item) }, 'Auswerten'),
      el('button', { class: 'x', 'aria-label': 'Eintrag verwerfen', onClick: async () => {
        if (confirm('Diesen gespeicherten Eintrag verwerfen?')) { await deleteQueued(item.id); renderToday(); }
      } }, '×')));
}

const de1 = (n) => String(n).replace('.', ',');

function suggestionCard(s, settings) {
  const diff = s.weightKg - settings.calcProfile.calcWeightKg;
  const text = s.reason === 'reachedTarget'
    ? `Zielgewicht erreicht. Neues Tagesziel zum Halten: ${s.to} kcal (bisher ${s.from}).`
    : `Du bist ${de1(Math.abs(Math.round(diff * 10) / 10))} kg ${diff < 0 ? 'leichter' : 'schwerer'} als bei der letzten Berechnung, dein Körper braucht dadurch ${diff < 0 ? 'weniger' : 'mehr'} Energie. Vorschlag: ${s.from} → ${s.to} kcal pro Tag.`;
  return el('div', { class: 'card suggest' },
    el('b', {}, 'Tagesziel anpassen?'),
    el('div', { class: 'muted', style: 'margin:4px 0 10px' }, text),
    el('div', { class: 'actions', style: 'margin:0' },
      el('button', { class: 'btn', onClick: async () => {
        await saveSettings({ ...(await getSettings()), suggestionDismissedWeight: s.weightKg });
        renderToday();
      } }, 'Später'),
      el('button', { class: 'primary', onClick: async () => {
        const fresh = await getSettings();
        await saveSettings({
          ...fresh,
          calorieGoal: s.to,
          suggestionDismissedWeight: null,
          calcProfile: { ...fresh.calcProfile, age: currentAge(fresh.calcProfile), calcDate: localDateKey(new Date()), calcWeightKg: s.weightKg, goal: s.calc.goalId },
        });
        renderToday();
      } }, 'Übernehmen')));
}

function backupCard(r) {
  const text = r.kind === 'never'
    ? `Du hast noch keine Sicherung gemacht, deine Daten gibt es seit ${r.days} Tagen nur auf diesem Handy. Eine Sicherung schützt vor Verlust, z. B. bei Handydefekt.`
    : `Deine letzte Sicherung ist ${r.days} Tage alt, seitdem sind neue Einträge dazugekommen.`;
  return el('div', { class: 'card suggest' },
    el('b', {}, 'Daten sichern?'),
    el('div', { class: 'muted', style: 'margin:4px 0 10px' }, text),
    el('div', { class: 'actions', style: 'margin:0' },
      el('button', { class: 'btn', onClick: async () => {
        await saveSettings({ ...(await getSettings()), backupSnoozedUntil: addDays(localDateKey(new Date()), 3) });
        renderToday();
      } }, 'In 3 Tagen'),
      el('button', { class: 'primary', onClick: async () => {
        const res = await shareBackup();
        if (res !== 'cancelled') { toast(res === 'shared' ? 'Sicherung geteilt.' : 'Sicherung heruntergeladen.'); renderToday(); }
      } }, 'Jetzt sichern')));
}

function petCard({ cfg, level, total, streak: stk, todayCount, daysSinceLast, weightToday, munch, todayKey }) {
  const hour = new Date().getHours();
  const mood = munch ? 'happy' : petMood({ todayCount, hour, daysSinceLast, streakCurrent: stk.current, weightToday });
  const text = munch
    ? 'Lecker, danke fürs Eintragen!'
    : petMessage({ mood, hour, name: cfg.name, streak: stk.current, todayCount, totalDays: total, dateKey: todayKey });
  const stats = total === 0
    ? `${cfg.name} wartet auf deinen ersten Eintrag`
    : `${cfg.name} · ${stk.current} ${stk.current === 1 ? 'Tag' : 'Tage'} in Folge · Rekord ${stk.best}`;
  return el('button', {
    class: 'card pet-card',
    'aria-label': `${cfg.name} öffnen`,
    onClick: () => openPetSheet({ name: cfg.name, level, total, streak: stk, nextAt: nextLevelAt(total) }),
  },
    el('div', { class: 'pet-fox' }, foxSvg({ mood, accessories: accessoriesFor(level).map((a) => a.id), munch, size: 96 })),
    el('div', { class: 'pet-text' },
      el('div', { class: 'bubble' }, text),
      el('div', { class: 'muted pet-stats' }, stats)));
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Heatmap: welche Tage hast du eingetragen? Die Farbe zeigt nur die Anzahl der Einträge, nicht Kalorien.
function calendarCard({ everyMeal, weights, todayKey, selected }) {
  const counts = {};
  for (const m of everyMeal) counts[m.dateKey] = (counts[m.dateKey] ?? 0) + 1;
  const todayMonth = { year: Number(todayKey.slice(0, 4)), month: Number(todayKey.slice(5, 7)) };
  const cal = calMonth ?? todayMonth;
  const g = monthGrid({ year: cal.year, month: cal.month, counts, weightDays: new Set(weights.map((w) => w.date)), todayKey });
  const label = new Date(cal.year, cal.month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const isCurrent = cal.year === todayMonth.year && cal.month === todayMonth.month;
  const move = (delta) => { calMonth = shiftMonth(cal, delta); renderToday(); };

  const cell = (c) => el('button', {
    class: `cal-day lv${c.level}${c.isToday ? ' today' : ''}${c.dateKey === selected ? ' sel' : ''}${c.isFuture ? ' future' : ''}`,
    disabled: c.isFuture,
    'aria-label': `${c.day}. ${label}: ${c.count} ${c.count === 1 ? 'Eintrag' : 'Einträge'}${c.weight ? ', Gewicht eingetragen' : ''}`,
    onClick: () => { go(c.dateKey); window.scrollTo({ top: 0, behavior: 'smooth' }); },
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
