import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD } from '../src/build-info.js';

test('Entwicklungsstand hat die Nummer 0 und meldet nie ein Update', () => {
  assert.equal(BUILD, 0);
});
