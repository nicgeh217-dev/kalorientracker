// Fuchs-Begleiter: reine Logik. Der Zustand wird immer aus den Einträgen abgeleitet (nichts extra gespeichert).
// Grundregel: Der Fuchs reagiert nur darauf, OB du einträgst, nie darauf, wie viel du isst oder ob du abnimmst.
import { addDays } from './overview.js';

export const THRESHOLDS = [3, 7, 14, 30, 60]; // Tracking-Tage für Stufe 1..5
export const MILESTONES = [3, 7, 14, 30, 60, 100]; // Serien, die gefeiert werden
export const ACCESSORIES = [
  { id: 'scarf', label: 'Halstuch' },
  { id: 'beanie', label: 'Mütze' },
  { id: 'glasses', label: 'Brille' },
  { id: 'crown', label: 'Krone' },
  { id: 'cape', label: 'Umhang' },
];

const dayNumber = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
export const daysBetween = (fromKey, toKey) => dayNumber(toKey) - dayNumber(fromKey);

// Tage, an denen mindestens eine Mahlzeit eingetragen wurde (aufsteigend, ohne Doppelte).
export function trackingDays(meals) {
  return [...new Set(meals.map((m) => m.dateKey).filter(Boolean))].sort();
}

// current: Tage in Folge bis heute. Ist heute noch nichts eingetragen, lebt die Serie bis zum Ende des Tages weiter.
// best: längste Serie überhaupt.
export function streak(days, todayKey) {
  if (!days.length) return { current: 0, best: 0 };
  const set = new Set(days);
  let cursor = set.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

export const petLevel = (totalDays) => THRESHOLDS.filter((t) => totalDays >= t).length;
export const nextLevelAt = (totalDays) => THRESHOLDS.find((t) => totalDays < t) ?? null;
export const accessoriesFor = (level) => ACCESSORIES.slice(0, level);
export const newUnlocks = (level, seenLevel) => (level > seenLevel ? ACCESSORIES.slice(seenLevel, level) : []);

export function slotFor(hour) {
  if (hour < 5 || hour >= 22) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'noon';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// todayCount: Einträge heute; daysSinceLast: Tage seit dem letzten Eintrag (null = noch nie).
export function petMood({ todayCount, hour, daysSinceLast, streakCurrent, weightToday }) {
  if (slotFor(hour) === 'night') return 'sleeping';
  if (todayCount > 0) return MILESTONES.includes(streakCurrent) || weightToday ? 'proud' : 'happy';
  if (daysSinceLast != null && daysSinceLast >= 2) return 'miss';
  return 'curious';
}

export const MESSAGE_BANK = {
  welcome: ['Hallo, ich bin {name}! Trag dein erstes Essen ein, dann sind wir ein Team.'],
  curious: {
    morning: ['Guten Morgen! Schon gefrühstückt? Zeig mal.', 'Morgen! Ein kurzer Eintrag fürs Frühstück, ja?', 'Hallo, Frühaufsteher! Was gab es zum Start in den Tag?'],
    noon: ['Mittagszeit! Was gab es bei dir?', 'Na, schon Pause? Trag dein Mittagessen kurz ein.', 'Zeit für einen Eintrag, ich bin neugierig.'],
    afternoon: ['Schon etwas gegessen? Ein kurzer Eintrag genügt.', 'Snack-Zeit? Ich merke mir alles für dich.', 'Kleiner Check: Fehlt noch ein Eintrag von heute?'],
    evening: ['Abendessen dran? Dann trag den Tag gleich ein.', 'Guten Abend! Fehlt heute noch ein Eintrag?', 'Gleich ist Feierabend. Kurz alles eintragen?'],
  },
  happy: ['Lecker, danke fürs Eintragen!', 'Das macht Spaß. Weiter so!', 'Notiert. Ich bin zufrieden.'],
  proudStreak: ['{streak} Tage in Folge! Das Tracken sitzt.', '{streak} Tage am Stück, ich bin stolz auf dich!'],
  proudWeight: ['Gewicht eingetragen, gut gemacht.', 'Danke fürs Wiegen und Eintragen!'],
  miss: ['Schön, dass du da bist! Ich habe dich vermisst.', 'Willkommen zurück! Ein kleiner Eintrag reicht für den Neustart.', 'Da bist du ja wieder. Kein Stress, wir fangen einfach neu an.'],
  sleepingLogged: ['Zzz … Gute Nacht!', 'Zzz … bis morgen!'],
  sleepingMissing: ['Zzz … Falls noch ein Eintrag fehlt: kurz nachtragen, dann schlafe ich gut.', 'Zzz … Du kannst heute noch etwas nachtragen. Gute Nacht!'],
};

// Deterministisch: gleicher Tag und gleiche Tageszeit -> gleicher Spruch (kein Flackern beim Neuzeichnen).
function pick(list, dateKey, salt) {
  const seed = [...dateKey].reduce((s, c) => s + c.charCodeAt(0), 0) + salt;
  return list[seed % list.length];
}

export function petMessage({ mood, hour, name, streak: streakDays, todayCount, totalDays, dateKey }) {
  const slot = slotFor(hour);
  const salt = ['night', 'morning', 'noon', 'afternoon', 'evening'].indexOf(slot);
  let list;
  if (mood === 'sleeping') list = todayCount > 0 ? MESSAGE_BANK.sleepingLogged : MESSAGE_BANK.sleepingMissing;
  else if (totalDays === 0) list = MESSAGE_BANK.welcome;
  else if (mood === 'proud') list = MILESTONES.includes(streakDays) ? MESSAGE_BANK.proudStreak : MESSAGE_BANK.proudWeight;
  else if (mood === 'happy') list = MESSAGE_BANK.happy;
  else if (mood === 'miss') list = MESSAGE_BANK.miss;
  else list = MESSAGE_BANK.curious[slot === 'night' ? 'evening' : slot];
  return pick(list, dateKey, salt).replaceAll('{name}', name).replaceAll('{streak}', String(streakDays));
}
