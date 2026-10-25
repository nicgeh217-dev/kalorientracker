import test from 'node:test';
import assert from 'node:assert/strict';
import { easeOutCubic, prefersReducedMotion } from '../src/views/motion.js';

test('easeOutCubic: Ränder, Beschleunigung am Anfang, begrenzt außerhalb 0..1', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
  assert.equal(easeOutCubic(-3), 0);
  assert.equal(easeOutCubic(7), 1);
});

test('easeOutCubic steigt über elf Stützstellen monoton', () => {
  let prev = -1;
  for (let i = 0; i <= 10; i += 1) {
    const v = easeOutCubic(i / 10);
    assert.ok(v >= prev, `Stelle ${i}`);
    prev = v;
  }
});

test('prefersReducedMotion ist ohne Browser falsch statt zu werfen', () => {
  assert.equal(prefersReducedMotion(), false);
});
