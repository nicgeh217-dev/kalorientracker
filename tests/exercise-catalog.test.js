import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_CATALOG, catalogSuggestions, matchesExercise } from '../src/exercise-catalog.js';
import { MUSCLES, DEFAULT_EXERCISES } from '../src/training.js';

test('Katalog: wesentlich mehr als die Startvorschläge, jede Muskelgruppe ist vertreten', () => {
  assert.ok(EXERCISE_CATALOG.length >= 100, `nur ${EXERCISE_CATALOG.length}`);
  for (const m of MUSCLES) assert.ok(EXERCISE_CATALOG.some((e) => e.muscle === m), m);
});

test('Katalog: gültige Muskelgruppen und keine doppelten Namen', () => {
  for (const e of EXERCISE_CATALOG) assert.ok(MUSCLES.includes(e.muscle), e.name);
  const names = EXERCISE_CATALOG.map((e) => e.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});

test('Katalog: enthält die gewünschten Übungen und alle Startvorschläge', () => {
  const names = EXERCISE_CATALOG.map((e) => e.name);
  for (const n of ['Latzug', 'Bizeps-Curls', 'Incline Bizeps-Curls', 'Hammer Curls', 'Incline Hammer Curls']) assert.ok(names.includes(n), n);
  for (const d of DEFAULT_EXERCISES) assert.ok(names.includes(d.name), d.name);
});

test('catalogSuggestions: ohne eigene Übungen, auch bei anderer Schreibweise', () => {
  const own = [{ id: 1, name: 'latzug', muscle: 'Rücken' }, { id: 2, name: 'Hammer-Curls', muscle: 'Arme' }];
  const names = catalogSuggestions(own, '').map((e) => e.name);
  assert.equal(names.includes('Latzug'), false);
  assert.equal(names.includes('Hammer Curls'), false);
  assert.ok(names.includes('Latzug eng'));
});

test('catalogSuggestions: Suche ignoriert Groß- und Kleinschreibung, Leerzeichen und Bindestriche', () => {
  const find = (q) => catalogSuggestions([], q).map((e) => e.name);
  assert.ok(find('LATZUG').includes('Latzug'));
  assert.ok(find('incline').includes('Incline Bizeps-Curls'));
  assert.ok(find('bizepscurls').includes('Bizeps-Curls'));
  assert.ok(find('hammer curl').includes('Incline Hammer Curls'));
  assert.deepEqual(find('gibtesnicht'), []);
});

test('catalogSuggestions: sortiert nach Muskelgruppe, dann nach Name', () => {
  const list = catalogSuggestions([], '');
  const order = list.map((e) => MUSCLES.indexOf(e.muscle));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  const arms = list.filter((e) => e.muscle === 'Arme').map((e) => e.name);
  assert.deepEqual(arms, [...arms].sort((a, b) => a.localeCompare(b, 'de')));
});

test('matchesExercise: auch die Muskelgruppe ist suchbar', () => {
  assert.equal(matchesExercise({ name: 'Beinpresse', muscle: 'Beine' }, 'presse'), true);
  assert.equal(matchesExercise({ name: 'Beinpresse', muscle: 'Beine' }, 'beine'), true);
  assert.equal(matchesExercise({ name: 'Beinpresse', muscle: 'Beine' }, 'brust'), false);
  assert.equal(matchesExercise({ name: 'Beinpresse', muscle: 'Beine' }, ''), true);
});
