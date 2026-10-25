import { el, toast, mount } from '../dom.js';
import { dayTotals, localDateKey } from '../logic.js';
import { suggestAdjustment, currentAge } from '../calorie.js';
import { fastLossCard } from './notes.js';
import { backupReminder } from '../backup.js';
import { pickNotice } from '../notices.js';
import { trackingDays, streak, petLevel, nextLevelAt, accessoriesFor, newUnlocks, petMood, petMessage, daysBetween } from '../pet.js';
import { foxSvg } from './fox.js';
import { openPetIntro, openPetSheet } from './pet-sheet.js';
import { shareBackup } from '../backup-share.js';
import { shouldShowWelcome } from '../welcome.js';
import { restoreFromText } from '../backup-import.js';
import { addDays, pickRecent, rollingAverage, fastLossWarning } from '../overview.js';
import {
  mealsForDate, deleteMeal, restoreMeal, getSettings, listProducts, replaceAll, addMeal, listMeals, getProduct, listQueued, deleteQueued, addQueued, listWeights, saveSettings,
} from '../db.js';
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
let celebratedLevel = null;

export async function renderToday() {
  const root = document.getElementById('view-today');
  for (const u of queueUrls) URL.revokeObjectURL(u);
  queueUrls = [];
  const dateKey = viewedDateKey();
  const isToday = isViewingToday();
  const [settings, meals, everyMeal, queued, weights, products] = await Promise.all([
    getSettings(),
    mealsForDate(dateKey),
    listMeals(),
    listQueued(),
    listWeights(),
    listProducts(),
  ]);
  const todayKey = localDateKey(new Date());
  const t = dayTotals(meals);
  const goal = settings.calorieGoal;
  const progress = goal ? Math.min(1, t.kcal / goal) : 0;
  const over = goal && t.kcal > goal;
  const centerNum = goal ? Math.abs(goal - t.kcal) : t.kcal;
  const centerUnit = goal ? (over ? 'kcal drüber' : 'kcal übrig') : 'kcal';
  const recent = pickRecent(everyMeal, 6);

  // Kalorienrechner: Vorschlag (nur mit Bestätigung) und Warnung bei zu schneller Abnahme
  const lastW = weights.at(-1);
  const avgW = lastW && lastW.date >= addDays(todayKey, -14) ? rollingAverage(weights, 7).at(-1).kg : null;
  const suggestion = isToday ? suggestAdjustment({ settings, avgWeightKg: avgW }) : null;
  const fastLoss = isToday ? fastLossWarning(weights) : null;
  const dataDates = [...everyMeal.map((m) => m.dateKey), ...weights.map((w) => w.date)].sort();
  const reminder = isToday ? backupReminder({
    lastBackupAt: settings.lastBackupAt, snoozedUntil: settings.backupSnoozedUntil,
    firstDataDate: dataDates[0] ?? null, lastDataDate: dataDates.at(-1) ?? null,
  }) : null;
  const notice = pickNotice({ fastLoss, suggestion, backup: reminder });
  const noticeNode = notice
    ? { fastLoss: () => fastLossCard(notice.data), suggestion: () => suggestionCard(notice.data, settings), backup: () => backupCard(notice.data) }[notice.kind]()
    : null;

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
    petNode = petStrip({
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

  mount(root,
    el('div', { class: 'dayhead' },
      el('div', {}, el('div', { class: 'eyebrow' }, longDate(dateKey)), el('h1', {}, dayLabel(dateKey))),
      el('div', { class: 'daynav' },
        el('button', { 'aria-label': 'Vorheriger Tag', onClick: () => go(addDays(dateKey, -1)) }, '‹'),
        el('button', { 'aria-label': 'Nächster Tag', disabled: isToday, onClick: () => go(addDays(dateKey, 1)) }, '›'))),
    isToday && shouldShowWelcome({ products, meals: everyMeal, weights, settings }) ? welcomeCard(settings) : null,
    noticeNode,
    petNode,
    el('div', { class: 'card hero2' },
      el('div', { class: `ring${over ? ' over' : ''}` },
        ring(progress),
        el('div', { class: 'center' },
          el('div', { class: 'num' }, String(centerNum)),
          el('div', { class: 'unit' }, centerUnit))),
      el('div', { class: 'hero-side' },
        goal
          ? el('div', { class: 'hs-row' },
              el('div', {}, el('b', {}, String(t.kcal)), 'gegessen'),
              el('div', {}, el('b', {}, String(goal)), 'Ziel'))
          : el('div', { class: 'note warn', style: 'margin:0' }, 'Noch kein Ziel. ',
              el('a', { href: '#', onClick: (e) => { e.preventDefault(); showView('settings'); } }, 'Jetzt festlegen')),
        el('div', { class: 'hs-macros' },
          macro('Protein', t.protein, 'var(--p)'),
          macro('Kohlenh.', t.carbs, 'var(--c)'),
          macro('Fett', t.fat, 'var(--f)')),
        settings.proteinGoal ? proteinGoalRow(t.protein, settings.proteinGoal) : null)),
    queued.length ? el('h2', {}, 'Wartet auf Auswertung') : null,
    ...queued.map(queueCard),
    recent.length ? el('div', { class: 'chips' }, ...recent.map((m) => recentChip(m, dateKey))) : null,
    el('h2', {}, 'Mahlzeiten'),
    ...(meals.length
      ? [...meals].reverse().map(mealCard)
      : [el('div', { class: 'card muted' }, isToday
          ? 'Noch nichts eingetragen. Tippe auf den Kamera-Button, um etwas einzutragen.'
          : 'Für diesen Tag ist nichts eingetragen. Mit dem Kamera-Button kannst du es nachtragen.')]));
}

function macro(label, grams, color) {
  return el('div', { class: 'mm' },
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

async function editMeal(m) {
  const product = m.productId != null ? await getProduct(m.productId) : null;
  const prefill = product
    ? { ...product, productId: product.id, amount: m.amount }
    : { name: m.name, basis: 'perServing', servingGrams: null, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, amount: { unit: 'servings', value: 1 } };
  openMealForm(prefill, { meal: m });
}

function mealCard(m, i) {
  const time = new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const amt = m.amount ? ` · ${String(m.amount.value).replace('.', ',')} ${m.amount.unit === 'g' ? 'g' : '×'}` : '';
  return el('div', { class: 'card meal', style: `--i:${i}` },
    el('div', { class: 'meal-top' },
      el('div', {}, el('strong', {}, m.name), el('div', { class: 'muted' }, `${time}${amt}`)),
      el('div', { class: 'xrow' },
        el('button', { class: 'x', 'aria-label': `${m.name} bearbeiten`, onClick: () => editMeal(m) }, '✎'),
        el('button', {
          class: 'x',
          'aria-label': `${m.name} löschen`,
          onClick: async () => {
            await deleteMeal(m.id);
            renderToday();
            toast(`${m.name} gelöscht`, 'Rückgängig', async () => { await restoreMeal(m); renderToday(); });
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
        await deleteQueued(item.id);
        renderToday();
        toast('Eintrag verworfen', 'Rückgängig', async () => {
          await addQueued({ blobs: item.blobs, hint: item.hint, dateKey: item.dateKey, createdAt: item.createdAt });
          renderToday();
        });
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

function welcomeCard(settings) {
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json,text/plain', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const r = await restoreFromText(await file.text(), replaceAll);
    if (!r.ok) return toast(r.error);
    toast(`Sicherung wiederhergestellt: ${r.counts.meals} Mahlzeiten, ${r.counts.weights} Gewichtseinträge.`);
    renderToday();
  });
  return el('div', { class: 'card suggest' },
    el('b', {}, 'Neu hier oder zurück?'),
    el('div', { class: 'muted', style: 'margin:4px 0 10px' }, 'Wenn du schon eine Sicherung hast, spiel sie hier ein. Sonst starte einfach neu.'),
    fileInput,
    el('div', { class: 'actions', style: 'margin:0' },
      el('button', { class: 'primary', onClick: () => fileInput.click() }, 'Sicherung wiederherstellen'),
      el('button', { class: 'btn', onClick: () => showView('settings') }, 'Gemini-Key eintragen'),
      el('button', { class: 'btn', onClick: async () => { await saveSettings({ ...(await getSettings()), welcomeDismissed: true }); renderToday(); } }, 'Neu starten')));
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

// Schmale Zeile: kleiner Fuchs, Sprechblase, Serie. Details (Stufen, Rekord, Umbenennen) im Dialog.
function petStrip({ cfg, level, total, streak: stk, todayCount, daysSinceLast, weightToday, munch, todayKey }) {
  const hour = new Date().getHours();
  const mood = munch ? 'happy' : petMood({ todayCount, hour, daysSinceLast, streakCurrent: stk.current, weightToday });
  const text = munch
    ? 'Lecker, danke fürs Eintragen!'
    : petMessage({ mood, hour, name: cfg.name, streak: stk.current, todayCount, totalDays: total, dateKey: todayKey });
  return el('button', {
    class: 'pet-strip',
    'aria-label': `${cfg.name} öffnen. ${stk.current} Tage in Folge, Rekord ${stk.best}`,
    onClick: () => openPetSheet({ name: cfg.name, level, total, streak: stk, nextAt: nextLevelAt(total) }),
  },
    el('div', { class: 'pet-fox' }, foxSvg({ mood, accessories: accessoriesFor(level).map((a) => a.id), munch, size: 54 })),
    el('div', { class: 'bubble' }, text),
    total > 0
      ? el('div', { class: 'streak' }, el('b', {}, String(stk.current)), el('span', {}, stk.current === 1 ? 'Tag' : 'Tage'))
      : null);
}
