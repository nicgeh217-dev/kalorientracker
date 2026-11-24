import test from "node:test";
import assert from "node:assert/strict";

test('bodyLine: mit Grenze nur die ersten Werte', async () => {
  const { bodyLine } = await import('../src/views/body-card.js');
  const day = { steps: 5500, sleepMin: 372, restingHr: 54, hrv: 36 };
  const all = bodyLine(day, ['steps', 'sleep', 'restingHr', 'hrv']);
  assert.equal(all.split(' · ').length, 4);
  assert.equal(bodyLine(day, ['steps', 'sleep', 'restingHr', 'hrv'], 3).split(' · ').length, 3);
});
