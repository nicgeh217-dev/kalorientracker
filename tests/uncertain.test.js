import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUncertain, describeUncertain } from '../src/uncertain.js';

test('cleanUncertain: bekannte Felder, einmalig, in der Reihenfolge der Antwort', () => {
  assert.deepEqual(cleanUncertain(['fat', 'kcal', 'fat', 'x', null]), ['fat', 'kcal']);
  assert.deepEqual(cleanUncertain(undefined), []);
  assert.deepEqual(cleanUncertain('kcal'), []);
});

test('describeUncertain: deutsche Namen in fester Reihenfolge, leer wenn nichts offen ist', () => {
  assert.equal(describeUncertain(new Set(['fat', 'kcal'])), 'Kalorien, Fett');
  assert.equal(describeUncertain(new Set(['servingGrams', 'basis'])), 'Bezugsgröße, Gramm pro Portion');
  assert.equal(describeUncertain(new Set()), '');
});
