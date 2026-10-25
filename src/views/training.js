import { el, mount, openSheet, closeSheet, toast } from '../dom.js';
import { localDateKey } from '../logic.js';
import { addDays } from '../overview.js';
import { weekOf } from '../week.js';
import {
  listExercises, listWorkouts, addExercise, updateExercise, deleteExercise, deleteWorkout, restoreWorkout,
  getTrainingDraft, setDayStatus, listDayStatuses,
} from '../db.js';
import { MUSCLES, DEFAULT_EXERCISES, trainingDaysThisWeek } from '../training.js';
import { getSettings, saveSettings } from '../db.js';
import { dayLabel } from '../state.js';
import { openWorkout } from './workout.js';

const shortDate = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
};

export async function renderTraining() {
  const root = document.getElementById('view-training');
  const todayKey = localDateKey(new Date());
  const [exercises, workouts, draft, statuses, settings] = await Promise.all([listExercises(), listWorkouts(), getTrainingDraft(), listDayStatuses(), getSettings()]);
  const lastWorkout = [...workouts].filter((w) => w.sets.length).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || (b.startedAt ?? 0) - (a.startedAt ?? 0))[0] ?? null;
  const status = statuses.find((s) => s.dateKey === todayKey)?.status ?? null;
  const todays = workouts.filter((w) => w.dateKey === todayKey);
  const recent = [...workouts].sort((a, b) => b.dateKey.localeCompare(a.dateKey) || (b.startedAt ?? 0) - (a.startedAt ?? 0)).slice(0, 10);
  const names = new Map(exercises.map((e) => [e.id, e]));

  const restToggle = el('button', {
    type: 'button', class: `chipbtn${status === 'rest' ? ' on' : ''}`, 'aria-pressed': status === 'rest' ? 'true' : 'false',
    onClick: async () => {
      if (status === 'sick') { toast('Du bist als krank markiert. Das kannst du im Verlauf ändern.'); return; }
      await setDayStatus(todayKey, status === 'rest' ? null : 'rest');
      renderTraining();
    },
  }, 'Heute Ruhetag');

  mount(root,
    el('h1', {}, 'Training'),
    el('button', { class: 'primary', style: 'width:100%', onClick: () => openWorkout({ resume: Boolean(draft) }) }, draft ? 'Offene Einheit fortsetzen' : 'Einheit starten'),
    !draft && lastWorkout ? el('button', { class: 'btn', style: 'width:100%;margin-top:8px', onClick: () => openWorkout({ template: lastWorkout }) }, `Letzte Einheit wiederholen (${lastWorkout.title})`) : null,
    el('div', { class: 'quick', style: 'margin-top:10px' }, restToggle,
      el('button', { type: 'button', class: 'chipbtn', onClick: openBackfill }, 'Nachtragen')),
    weekCard(workouts, settings, todayKey),
    el('div', { class: 'card' },
      el('b', {}, 'Heute'),
      todays.length
        ? el('div', { class: 'muted' }, todays.map((w) => `${w.title}${w.durationMin ? ` · ${w.durationMin} min` : ''} · ${w.sets.length} Sätze`).join(' | '))
        : el('div', { class: 'muted' }, status === 'rest' ? 'Ruhetag. Erholung gehört zum Training.' : status === 'sick' ? 'Du bist als krank markiert. Gute Besserung.' : 'Heute noch kein Training.')),
    el('h2', {}, 'Letzte Einheiten'),
    recent.length
      ? el('div', { class: 'card slotlist' }, ...recent.map((w) => workoutRow(w, names)))
      : el('div', { class: 'card muted' }, 'Noch keine Einheit. Starte deine erste.'),
    el('h2', {}, 'Übungen'),
    exerciseLibrary(exercises));
}

function workoutRow(w, names) {
  return el('button', { class: 'mrow', onClick: () => openDetails(w, names) },
    el('div', { class: 'mt' }, el('strong', {}, w.title), el('div', { class: 'muted' }, `${dayLabel(w.dateKey) === 'Heute' ? 'Heute' : shortDate(w.dateKey)}${w.durationMin ? ` · ${w.durationMin} min` : ''}`)),
    el('div', { class: 'mk' }, String(w.sets.length), el('small', {}, w.sets.length === 1 ? 'Satz' : 'Sätze')));
}

function openDetails(w, names) {
  const groups = new Map();
  for (const s of w.sets) {
    if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, []);
    groups.get(s.exerciseId).push(s);
  }
  openSheet(
    el('h1', {}, w.title),
    el('div', { class: 'muted', style: 'margin:-8px 4px 12px' }, `${shortDate(w.dateKey)}${w.durationMin ? ` · ${w.durationMin} min` : ''}`),
    w.sets.length
      ? el('div', { class: 'card' }, ...[...groups.entries()].map(([id, sets]) => el('div', { style: 'margin-bottom:8px' },
          el('b', {}, names.get(id)?.name ?? 'Gelöschte Übung'),
          el('div', { class: 'muted' }, sets.map((s) => `${s.kg > 0 ? `${String(s.kg).replace('.', ',')} kg` : 'Körpergewicht'} × ${s.reps}`).join(' · ')))))
      : el('div', { class: 'card muted' }, 'Keine Sätze gespeichert.'),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Schließen'),
      el('button', { class: 'btn wide', onClick: () => { closeSheet(); openWorkout({ template: w }); } }, 'Diese Einheit wiederholen'),
      el('button', {
        class: 'btn danger wide',
        onClick: async () => {
          await deleteWorkout(w.id);
          closeSheet();
          renderTraining();
          toast('Einheit gelöscht', 'Rückgängig', async () => { await restoreWorkout(w); renderTraining(); });
        },
      }, 'Löschen')));
}

function openBackfill() {
  const today = localDateKey(new Date());
  const date = el('input', { id: 'backfill-date', type: 'date', value: addDays(today, -1), max: today });
  openSheet(
    el('h1', {}, 'Training nachtragen'),
    el('label', { for: 'backfill-date' }, 'Tag'), date,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
      el('button', { class: 'primary', onClick: () => { if (!date.value || date.value > today) return; closeSheet(); openWorkout({ dateKey: date.value }); } }, 'Weiter')));
}

function exerciseLibrary(exercises) {
  const add = () => openExerciseForm(null);
  const missing = DEFAULT_EXERCISES.filter((d) => !exercises.some((e) => e.name === d.name));
  if (exercises.length < 3 && missing.length) {
    return el('div', {},
      exercises.length ? exerciseGroups(exercises) : null,
      el('div', { class: 'card' },
      el('div', { class: 'muted', style: 'margin-bottom:10px' }, exercises.length ? 'Weitere Vorschläge:' : 'Deine Übungsliste ist leer. Nimm Vorschläge oder lege eigene an.'),
      ...missing.map((d) => el('div', { class: 'row', style: 'margin-bottom:8px' },
        el('span', {}, el('b', {}, d.name), el('span', { class: 'muted' }, ` · ${d.muscle}`)),
        el('button', { class: 'small ghost', onClick: async (ev) => { ev.currentTarget.disabled = true; await addExercise(d); renderTraining(); } }, 'Hinzufügen'))),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onClick: add }, 'Eigene Übung'),
        el('button', { class: 'primary', onClick: async (ev) => { ev.currentTarget.disabled = true; for (const d of missing) await addExercise(d); renderTraining(); } }, 'Alle hinzufügen'))));
  }
  return el('div', {}, exerciseGroups(exercises), el('button', { class: 'btn', style: 'width:100%', onClick: add }, '+ Übung anlegen'));
}

function exerciseGroups(exercises) {
  const groups = MUSCLES.map((m) => [m, exercises.filter((e) => e.muscle === m)]).filter(([, list]) => list.length);
  return el('div', {},
    ...groups.map(([muscle, list]) => el('div', { class: 'slot' },
      el('div', { class: 'muted', style: 'margin:0 4px 6px;font-weight:700' }, muscle),
      el('div', { class: 'card slotlist' }, ...list.sort((a, b) => a.name.localeCompare(b.name, 'de')).map((e) => el('button', { class: 'mrow', style: 'min-height:48px', onClick: () => openExerciseForm(e) }, el('div', { class: 'mt' }, el('strong', {}, e.name))))))));
}

// e = null: neue Übung. Sonst umbenennen, Muskelgruppe ändern oder löschen (Rückgängig stellt sie mit derselben ID wieder her).
export function openExerciseForm(e, { onSaved = null } = {}) {
  const name = el('input', { value: e?.name ?? '', placeholder: 'z. B. Beinpresse', 'aria-label': 'Name der Übung' });
  const muscle = el('select', { 'aria-label': 'Muskelgruppe' }, ...MUSCLES.map((m) => el('option', { value: m, selected: (e?.muscle ?? 'Ganzkörper') === m }, m)));
  const msg = el('div');
  openSheet(
    el('h1', {}, e ? 'Übung bearbeiten' : 'Neue Übung'),
    el('label', {}, 'Name'), name,
    el('label', {}, 'Muskelgruppe'), muscle,
    msg,
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Abbrechen'),
      el('button', {
        class: 'primary',
        onClick: async () => {
          const n = name.value.trim();
          if (!n) return msg.replaceChildren(el('div', { class: 'note bad' }, 'Bitte einen Namen eingeben.'));
          let saved;
          if (e) { saved = { ...e, name: n, muscle: muscle.value }; await updateExercise(saved); } else { saved = { name: n, muscle: muscle.value }; saved.id = await addExercise(saved); }
          closeSheet();
          await (onSaved ? onSaved(saved) : renderTraining());
        },
      }, 'Speichern'),
      e ? el('button', {
        class: 'btn danger wide',
        onClick: async () => {
          await deleteExercise(e.id);
          closeSheet();
          renderTraining();
          toast(`${e.name} gelöscht. Eingetragene Einheiten bleiben erhalten.`, 'Rückgängig', async () => { await updateExercise(e); renderTraining(); });
        },
      }, 'Löschen') : null));
}

const DAY_LETTERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Trainingstage dieser Woche. Das Ziel ist nur eine Zahl zum Mitzählen: nie Rot, nie ein Urteil, auch wenn man darüber oder darunter liegt.
function weekCard(workouts, settings, todayKey) {
  const { count, days } = trainingDaysThisWeek(workouts, todayKey);
  const goal = settings.trainingGoalDays ?? null;
  const monday = weekOf(todayKey);
  return el('button', { class: 'card weekgoal', 'aria-label': 'Wochenziel ändern', onClick: () => openGoalSheet(goal) },
    el('div', { class: 'row' },
      el('div', {},
        el('div', { class: 'muted' }, 'Diese Woche'),
        el('div', {}, el('span', { class: 'num', style: 'font-size:34px' }, String(count)),
          el('span', { class: 'muted' }, goal ? ` von ${goal} Trainingstagen` : count === 1 ? ' Trainingstag' : ' Trainingstage'))),
      el('div', { class: 'wgdots', 'aria-hidden': 'true' }, ...monday.map((d, i) => el('div', { class: `wgd${days.includes(d) ? ' on' : ''}${d > todayKey ? ' future' : ''}` }, el('i', {}), el('span', {}, DAY_LETTERS[i]))))),
    goal ? null : el('div', { class: 'muted', style: 'margin-top:6px' }, 'Tippen, um ein Wochenziel zu setzen (optional).'));
}

function openGoalSheet(current) {
  const choose = async (n) => {
    await saveSettings({ ...(await getSettings()), trainingGoalDays: n });
    closeSheet();
    renderTraining();
  };
  openSheet(
    el('h1', {}, 'Wochenziel'),
    el('div', { class: 'muted', style: 'margin:-8px 4px 12px' }, 'Wie viele Tage pro Woche möchtest du trainieren? Die App zählt nur mit, sie bewertet nichts.'),
    el('div', { class: 'quick', style: 'flex-wrap:wrap' }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => el('button', { type: 'button', class: `chipbtn${current === n ? ' on' : ''}`, style: 'flex:1 0 20%', onClick: () => choose(n) }, String(n)))),
    el('div', { class: 'actions' },
      el('button', { class: 'btn', onClick: closeSheet }, 'Schließen'),
      el('button', { class: 'btn', onClick: () => choose(null) }, 'Kein Ziel')));
}
