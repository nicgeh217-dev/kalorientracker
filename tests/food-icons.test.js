import test from 'node:test';
import assert from 'node:assert/strict';
import { ICON_IDS, foodIconFor } from '../src/food-icons.js';

test('Zuordnung nach Namen', () => {
  const cases = {
    'Triangle Kimbap Thunfisch': 'onigiri',
    '삼각김밥 참치마요': 'onigiri',
    'Shin Ramyun': 'ramyun',
    'Banana Milk': 'milk',
    'Reis': 'rice',
    'Eier mit Speck': 'egg',
    'Chicken Salad Wrap': 'drumstick',
    'Apfel': 'apple',
    'Unbekanntes Zeug': 'plate',
    '': 'plate',
  };
  for (const [name, id] of Object.entries(cases)) assert.equal(foodIconFor(name), id, name);
});

test('kurze Schlüsselwörter nur bei exakter Gleichheit', () => {
  assert.equal(foodIconFor('Eisenbahn'), 'plate'); // "eis" darf nicht per Präfix passen
  assert.equal(foodIconFor('Eis'), 'candy');
  assert.equal(foodIconFor('Nudeln mit Ei'), 'ramyun'); // ramyun hat Vorrang vor egg
});

test('null/undefined-Name ergibt plate, zwölf Symbole in fester Reihenfolge', () => {
  assert.equal(foodIconFor(null), 'plate');
  assert.equal(foodIconFor(undefined), 'plate');
  assert.deepEqual(ICON_IDS, ['onigiri', 'ramyun', 'milk', 'drumstick', 'rice', 'bread', 'egg', 'broccoli', 'apple', 'candy', 'avocado', 'plate']);
});
