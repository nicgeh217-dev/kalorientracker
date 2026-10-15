import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trackingDays, streak, petLevel, nextLevelAt, accessoriesFor, newUnlocks, slotFor, petMood, petMessage, MESSAGE_BANK, daysBetween,
} from '../src/pet.js';

const meals = (...keys) => keys.map((dateKey, i) => ({ id: i, dateKey }));

test('trackingDays: eindeutige, sortierte Tage mit Mahlzeiten', () => {
  assert.deepEqual(trackingDays(meals('2026-10-12', '2026-10-10', '2026-10-12', undefined)), ['2026-10-10', '2026-10-12']);
  assert.deepEqual(trackingDays([]), []);
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-10-10', '2026-10-13'), 3);
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(daysBetween('2026-10-13', '2026-10-13'), 0);
});

test('streak: heute eingetragen zählt mit', () => {
  const s = streak(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-12');
  assert.equal(s.current, 3);
  assert.equal(s.best, 3);
});

test('streak: heute noch nichts, gestern ja -> Serie lebt noch', () => {
  assert.equal(streak(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-13').current, 3);
});

test('streak: seit gestern kein Eintrag mehr (vorgestern zuletzt) -> Serie 0', () => {
  assert.equal(streak(['2026-10-10', '2026-10-11', '2026-10-12'], '2026-10-14').current, 0);
});

test('streak: Rekord bleibt erhalten, auch über Monatsgrenzen', () => {
  const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-10', '2026-10-11'];
  const s = streak(days, '2026-10-11');
  assert.equal(s.current, 2);
  assert.equal(s.best, 4);
});

test('streak: keine Daten', () => {
  assert.deepEqual(streak([], '2026-10-12'), { current: 0, best: 0 });
});

test('Level nach Gesamtzahl der Tracking-Tage', () => {
  const lv = [0, 2, 3, 6, 7, 13, 14, 29, 30, 59, 60, 400].map(petLevel);
  assert.deepEqual(lv, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('Nächste Stufe', () => {
  assert.equal(nextLevelAt(0), 3);
  assert.equal(nextLevelAt(3), 7);
  assert.equal(nextLevelAt(59), 60);
  assert.equal(nextLevelAt(60), null);
});

test('Accessoires wachsen mit dem Level', () => {
  assert.deepEqual(accessoriesFor(0), []);
  assert.deepEqual(accessoriesFor(2).map((a) => a.id), ['scarf', 'beanie']);
  assert.equal(accessoriesFor(5).length, 5);
});

test('newUnlocks: nur neue Stufen seit dem letzten Mal', () => {
  assert.deepEqual(newUnlocks(2, 1).map((a) => a.id), ['beanie']);
  assert.deepEqual(newUnlocks(3, 1).map((a) => a.id), ['beanie', 'glasses']);
  assert.deepEqual(newUnlocks(2, 2), []);
  assert.deepEqual(newUnlocks(1, 3), []);
});

test('Tageszeit-Slots', () => {
  const map = [[3, 'night'], [4, 'night'], [5, 'morning'], [10, 'morning'], [11, 'noon'], [13, 'noon'], [14, 'afternoon'], [17, 'afternoon'], [18, 'evening'], [21, 'evening'], [22, 'night'], [23, 'night']];
  for (const [h, slot] of map) assert.equal(slotFor(h), slot, `Stunde ${h}`);
});

const mood = (over) => petMood({ todayCount: 0, hour: 12, daysSinceLast: 1, streakCurrent: 0, weightToday: false, ...over });

test('Stimmung: nachts schläft der Fuchs, egal ob eingetragen', () => {
  assert.equal(mood({ hour: 23 }), 'sleeping');
  assert.equal(mood({ hour: 3, todayCount: 4 }), 'sleeping');
});

test('Stimmung: heute eingetragen -> glücklich, bei Serien-Meilenstein oder Gewicht stolz', () => {
  assert.equal(mood({ todayCount: 1 }), 'happy');
  assert.equal(mood({ todayCount: 1, streakCurrent: 7 }), 'proud');
  assert.equal(mood({ todayCount: 1, weightToday: true }), 'proud');
  assert.equal(mood({ todayCount: 1, streakCurrent: 5 }), 'happy');
});

test('Stimmung: noch nichts heute -> neugierig; 2+ Tage Pause -> vermisst dich', () => {
  assert.equal(mood({ daysSinceLast: 0 }), 'curious');
  assert.equal(mood({ daysSinceLast: 1 }), 'curious');
  assert.equal(mood({ daysSinceLast: 2 }), 'miss');
  assert.equal(mood({ daysSinceLast: 9 }), 'miss');
  assert.equal(mood({ daysSinceLast: null }), 'curious'); // noch nie etwas eingetragen
});

const msg = (over) => petMessage({ mood: 'curious', hour: 9, name: 'Foxi', streak: 0, todayCount: 0, totalDays: 5, dateKey: '2026-10-15', ...over });

test('Nachricht: deterministisch (gleiche Eingabe, gleicher Text)', () => {
  assert.equal(msg({}), msg({}));
});

test('Nachricht: erster Start begrüßt mit dem Namen', () => {
  assert.match(msg({ totalDays: 0 }), /Foxi/);
});

test('Nachricht: Tageszeit passt (morgens vs. mittags vs. abends)', () => {
  const texts = new Set([msg({ hour: 8 }), msg({ hour: 12 }), msg({ hour: 15 }), msg({ hour: 19 })]);
  assert.equal(texts.size >= 3, true);
});

test('Nachricht: stolz nennt die Serie', () => {
  assert.match(msg({ mood: 'proud', streak: 7, todayCount: 2 }), /7 Tage/);
});

test('Nachricht: nachts nicht eingetragen -> sanfte Erinnerung, eingetragen -> Gute Nacht', () => {
  assert.match(msg({ mood: 'sleeping', hour: 23, todayCount: 0 }), /nachtragen/);
  assert.doesNotMatch(msg({ mood: 'sleeping', hour: 23, todayCount: 2 }), /nachtragen/);
});

test('Alle Sprüche: keine Wertung von Essen, Kalorien, Gewicht oder Körper', () => {
  const banned = /kcal|kalorie|zu viel|zu wenig|diät|abnehm|zunehm|schlecht|sünde|fett|dick|schlank|verboten|schuld|enttäusch/i;
  const all = Object.values(MESSAGE_BANK).flatMap((v) => (Array.isArray(v) ? v : Object.values(v).flat()));
  assert.ok(all.length >= 20);
  for (const t of all) assert.doesNotMatch(t, banned, t);
});

test('Jede Stimmung und jede Tageszeit liefert einen Text', () => {
  for (const m of ['sleeping', 'happy', 'proud', 'curious', 'miss']) {
    for (const hour of [2, 8, 12, 15, 19, 23]) {
      for (const todayCount of [0, 3]) {
        const t = msg({ mood: m, hour, todayCount, streak: 3, totalDays: 4 });
        assert.equal(typeof t, 'string');
        assert.ok(t.length > 5, `${m}/${hour}/${todayCount}`);
      }
    }
  }
});
