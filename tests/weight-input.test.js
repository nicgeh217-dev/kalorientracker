import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeight } from '../src/weight-input.js';

test('Komma und Punkt', () => {
  assert.equal(parseWeight('72,5'), 72.5);
  assert.equal(parseWeight('72.5'), 72.5);
});

test('Leerzeichen und ganze Zahlen', () => {
  assert.equal(parseWeight(' 80 '), 80);
});

test('Ungültiges -> null', () => {
  for (const bad of ['abc', '', '0', '-5', '1000', '19.9', '72,5kg', '7,2,5', null, undefined]) {
    assert.equal(parseWeight(bad), null, `"${bad}" sollte abgelehnt werden`);
  }
});
