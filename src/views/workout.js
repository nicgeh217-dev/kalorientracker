import { el, openSheet, closeSheet, toast, parseNum } from '../dom.js';
import { localDateKey } from '../logic.js';
import { refreshCurrent } from '../nav.js';
import {
  listExercises, listWorkouts, addWorkout, getTrainingDraft, saveTrainingDraft, clearTrainingDraft,
} from '../db.js';
import { lastSetsFor, isNewRecord, restRemaining, draftToWorkout, epley1RM, repeatDraft } from '../training.js';
import { dayHeading } from '../state.js';
import { foxSvg } from './fox.js';
import { prefersReducedMotion } from './motion.js';
import { openExerciseForm } from './training.js';

const REST_MIN = 30;
const REST_MAX = 300;
const de = (n) => (n == null ? '' : String(n).replace('.', ','));
const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Vollbild-Dialog für eine Trainingseinheit. Ein offener Entwurf wird immer fortgesetzt, damit nichts verloren geht.
let opening = false;

export async function openWorkout({ dateKey = null, template = null } = {}) {
  if (opening || document.getElementById('workout-root')) return;
  opening = true;
  const [exercises, workouts, saved] = await Promise.all([listExercises(), listWorkouts(), getTrainingDraft()]);
  const today = localDateKey(new Date());
  const draft = saved ?? (template
    ? repeatDraft(template, exercises, dateKey ?? today, Date.now(), { today })
    : { dateKey: dateKey ?? today, startedAt: Date.now(), restSec: 90, manual: (dateKey ?? today) !== today, entries: [] });
  draft.restSec ??= 90;
  if (saved && dateKey && dateKey !== saved.dateKey) toast('Eine offene Einheit wurde fortgesetzt.');

  const root = el('div', { id: 'workout-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Einheit' });
  document.body.append(root);
  opening = false;
  let rest = null; // { startedAt }
  let tickTimer = null;
  let saveTimer = null;
  let celebrate = null;

  const names = () => new Map(exercises.map((e) => [e.id, e]));

  // ---------- Entwurf speichern (entprellt, höchstens alle 500 ms) ----------
  const flush = async () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    await saveTrainingDraft(draft);
  };
  const schedule = () => { if (!saveTimer) saveTimer = setTimeout(flush, 500); };
  const flushHidden = () => { if (document.hidden && saveTimer) flush(); };
  document.addEventListener('visibilitychange', flushHidden);
  window.addEventListener('pagehide', flush);

  // ---------- Pausen-Timer ----------
  const timerText = el('span', { class: 'rt-time' });
  const timerBar = el('div', { class: 'resttimer' });
  function drawTimer() {
    const left = rest ? restRemaining(rest.startedAt, Date.now(), draft.restSec) : 0;
    if (rest && left === 0) {
      rest = null;
      navigator.vibrate?.([200, 100, 200]);
    }
    timerBar.classList.toggle('running', Boolean(rest));
    timerText.textContent = rest ? `Pause ${clock(left)}` : `Pause ${draft.restSec} s`;
  }
  const setRestSec = (delta) => {
    draft.restSec = Math.min(REST_MAX, Math.max(REST_MIN, draft.restSec + delta));
    schedule();
    drawTimer();
  };
  timerBar.append(
    el('button', { type: 'button', class: 'small ghost', 'aria-label': 'Pause kürzer', onClick: () => setRestSec(-15) }, '−15'),
    timerText,
    el('button', { type: 'button', class: 'small ghost', 'aria-label': 'Pause länger', onClick: () => setRestSec(15) }, '+15'),
    el('button', { type: 'button', class: 'small ghost', onClick: () => { rest = null; drawTimer(); } }, 'Stopp'));
  tickTimer = setInterval(drawTimer, 250);

  // ---------- Rekord-Feier ----------
  function showRecord(name, e1) {
    toast(`Neuer Rekord: ${name}, geschätzt ${de(e1)} kg`, null, null, 3500);
    if (prefersReducedMotion()) return;
    celebrate?.remove();
    celebrate = el('div', { class: 'recordfox', 'aria-hidden': 'true' }, foxSvg({ mood: 'proud', accessories: ['crown'], size: 110 }),
      ...[0, 1, 2, 3].map((i) => el('span', { class: `spark s${i}` }, '✦')));
    root.append(celebrate);
    const mine = celebrate;
    setTimeout(() => mine.remove(), 1600);
  }

  // ---------- Sätze ----------
  const priorWorkouts = (exerciseId, uptoSet) => {
    const entry = draft.entries.find((e) => e.exerciseId === exerciseId);
    const earlier = entry ? entry.sets.filter((s) => s !== uptoSet && s.done && s.reps >= 1).map((s) => ({ exerciseId, kg: s.kg ?? 0, reps: s.reps })) : [];
    return [...workouts, { dateKey: draft.dateKey, startedAt: draft.startedAt, sets: earlier }];
  };

  function toggleDone(entry, set) {
    if (!set.done && !(set.reps >= 1)) { toast('Trag erst die Wiederholungen ein.'); return; }
    set.done = !set.done;
    if (set.done) {
      draft.lastActivityAt = Date.now();
      navigator.vibrate?.(30);
      rest = { startedAt: Date.now() };
      const kg = set.kg ?? 0;
      if (!set.celebrated && isNewRecord(priorWorkouts(entry.exerciseId, set), entry.exerciseId, { kg, reps: set.reps })) {
        set.celebrated = true;
        showRecord(names().get(entry.exerciseId)?.name ?? 'Übung', epley1RM(kg, set.reps));
      }
    } else {
      rest = null;
    }
    schedule();
    draw();
    drawTimer();
  }

  function addSet(entry) {
    const prev = entry.sets.at(-1);
    entry.sets.push({ kg: prev?.kg ?? null, reps: prev?.reps ?? null, done: false });
    schedule();
    draw();
  }

  function addExerciseToDraft(exercise) {
    if (draft.entries.some((e) => e.exerciseId === exercise.id)) return;
    const last = lastSetsFor(workouts, exercise.id);
    draft.entries.push({
      exerciseId: exercise.id,
      sets: last.length ? last.map((s) => ({ kg: s.kg, reps: s.reps, done: false })) : [{ kg: null, reps: null, done: false }],
    });
    schedule();
    draw();
  }

  function pickExercise() {
    const query = el('input', { placeholder: 'Übung suchen', 'aria-label': 'Übung suchen' });
    const list = el('div', { class: 'card slotlist' });
    const used = new Set(draft.entries.map((e) => e.exerciseId));
    const fill = () => {
      const q = query.value.trim().toLowerCase();
      const hits = exercises.filter((x) => !used.has(x.id) && x.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      list.replaceChildren(...(hits.length
        ? hits.map((x) => el('button', { class: 'mrow', style: 'min-height:48px', onClick: () => { closeSheet(); addExerciseToDraft(x); } },
            el('div', { class: 'mt' }, el('strong', {}, x.name), el('div', { class: 'muted' }, x.muscle))))
        : [el('div', { class: 'slotempty muted' }, exercises.length ? 'Keine passende Übung.' : 'Noch keine Übung. Lege unten eine an.')]));
    };
    query.addEventListener('input', fill);
    fill();
    openSheet(
      el('h1', {}, 'Übung wählen'),
      query, el('div', { style: 'height:10px' }), list,
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
        el('button', {
          class: 'primary',
          onClick: () => openExerciseForm(null, { onSaved: async (e) => { exercises.push(e); addExerciseToDraft(e); } }),
        }, 'Neue Übung')));
  }

  // ---------- Abschluss ----------
  async function finish() {
    const w = draftToWorkout(draft, Date.now(), exercises);
    if (!w.sets.length) return toast('Hake mindestens einen Satz mit Wiederholungen ab.');
    await addWorkout(w);
    await close(true);
    toast(`Einheit gespeichert: ${w.title}, ${w.sets.length} ${w.sets.length === 1 ? 'Satz' : 'Sätze'}`);
    refreshCurrent();
  }

  async function close(clear) {
    document.removeEventListener('visibilitychange', flushHidden);
    window.removeEventListener('pagehide', flush);
    clearInterval(tickTimer);
    clearTimeout(saveTimer);
    if (clear) await clearTrainingDraft(); else await saveTrainingDraft(draft);
    root.remove();
    refreshCurrent();
  }

  function askCancel() {
    if (!draft.entries.length) { close(true); return; }
    openSheet(
      el('h1', {}, 'Einheit beenden?'),
      el('div', { class: 'muted', style: 'margin:-8px 4px 12px' }, 'Du kannst sie später fortsetzen oder verwerfen.'),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onClick: closeSheet }, 'Weiter trainieren'),
        el('button', { class: 'primary', onClick: () => { closeSheet(); close(false); } }, 'Später fortsetzen'),
        el('button', { class: 'btn danger wide', onClick: () => { closeSheet(); close(true); } }, 'Entwurf verwerfen')));
  }

  // ---------- Zeichnen ----------
  const body = el('div', { class: 'wbody' });
  function entryCard(entry) {
    const ex = names().get(entry.exerciseId);
    const last = lastSetsFor(workouts, entry.exerciseId);
    return el('div', { class: 'card wentry' },
      el('div', { class: 'row' }, el('b', {}, ex?.name ?? 'Gelöschte Übung'), el('span', { class: 'muted' }, ex?.muscle ?? '')),
      last.length ? el('div', { class: 'muted', style: 'margin:2px 0 8px' }, `Letztes Mal: ${last.map((s) => `${s.kg > 0 ? de(s.kg) : 'KG'} × ${s.reps}`).join(', ')}`) : el('div', { style: 'height:8px' }),
      ...entry.sets.map((set, i) => {
        const kg = el('input', { inputMode: 'decimal', value: de(set.kg), placeholder: 'kg', title: 'Leer = Körpergewicht', 'aria-label': `Satz ${i + 1} Gewicht in kg` });
        const reps = el('input', { inputMode: 'numeric', value: set.reps == null ? '' : String(set.reps), placeholder: 'Wdh.', 'aria-label': `Satz ${i + 1} Wiederholungen` });
        kg.addEventListener('input', () => { set.kg = parseNum(kg.value); schedule(); });
        reps.addEventListener('input', () => { const n = parseNum(reps.value); set.reps = n == null ? null : Math.round(n); schedule(); });
        return el('div', { class: `wset${set.done ? ' done' : ''}` },
          el('span', { class: 'wn' }, String(i + 1)), kg, reps,
          el('button', { type: 'button', class: 'wcheck', 'aria-pressed': set.done ? 'true' : 'false', 'aria-label': `Satz ${i + 1} erledigt`, onClick: () => toggleDone(entry, set) }, '✓'));
      }),
      el('button', { type: 'button', class: 'small ghost', style: 'margin-top:8px', onClick: () => addSet(entry) }, 'Satz hinzufügen'));
  }
  function draw() {
    body.replaceChildren(
      ...draft.entries.map(entryCard),
      draft.entries.length ? null : el('div', { class: 'card muted' }, 'Füge deine erste Übung hinzu.'),
      el('button', { class: 'btn', style: 'width:100%', onClick: pickExercise }, '+ Übung hinzufügen'));
  }

  root.append(
    el('div', { class: 'whead' },
      el('button', { class: 'small ghost', onClick: askCancel }, 'Abbrechen'),
      el('div', { class: 'wtitle' }, el('b', {}, 'Einheit'), el('div', { class: 'muted' }, draft.dateKey === today ? 'Heute' : dayHeading(draft.dateKey))),
      el('button', { class: 'small primary', onClick: finish }, 'Fertig')),
    timerBar, body);
  draw();
  drawTimer();
}
