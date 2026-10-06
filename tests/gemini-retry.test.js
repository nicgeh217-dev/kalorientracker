import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithFallback } from '../src/gemini-retry.js';

const noSleep = async () => {};
const script = (...steps) => {
  const calls = [];
  const call = async (model) => {
    calls.push(model);
    return steps.shift();
  };
  return { call, calls };
};
const ok = { status: 200, json: { x: 1 } };

test('503 dann 200 beim selben Modell -> ok nach Wiederholung', async () => {
  const { call, calls } = script({ status: 503 }, ok);
  const r = await runWithFallback(['A', 'B'], call, { sleep: noSleep });
  assert.equal(r.ok, true);
  assert.equal(r.model, 'A');
  assert.deepEqual(calls, ['A', 'A']);
});

test('A dauerhaft 503 -> wechselt auf B', async () => {
  const { call, calls } = script({ status: 503 }, { status: 503 }, ok);
  const r = await runWithFallback(['A', 'B'], call, { sleep: noSleep });
  assert.equal(r.ok, true);
  assert.equal(r.model, 'B');
  assert.deepEqual(calls, ['A', 'A', 'B']);
});

test('404 bei A -> sofort B, ohne Wiederholung', async () => {
  const { call, calls } = script({ status: 404 }, ok);
  const r = await runWithFallback(['A', 'B'], call, { sleep: noSleep });
  assert.equal(r.model, 'B');
  assert.deepEqual(calls, ['A', 'B']);
});

test('403 (Key) -> sofort Abbruch, kein Wechsel', async () => {
  const { call, calls } = script({ status: 403 });
  const r = await runWithFallback(['A', 'B'], call, { sleep: noSleep });
  assert.deepEqual(r, { ok: false, status: 403, model: 'A' });
  assert.deepEqual(calls, ['A']);
});

test('429 (Limit) -> Abbruch, kein Wechsel', async () => {
  const { call, calls } = script({ status: 429 });
  const r = await runWithFallback(['A', 'B'], call, { sleep: noSleep });
  assert.equal(r.status, 429);
  assert.deepEqual(calls, ['A']);
});

test('überall 503 -> Fehler mit letztem Status', async () => {
  const { call } = script({ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 });
  const r = await runWithFallback(['A', 'B'], call, { sleep: noSleep });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
});

test('Wartezeit zwischen Wiederholungen wird genutzt', async () => {
  const waits = [];
  const { call } = script({ status: 503 }, ok);
  await runWithFallback(['A'], call, { delayMs: 1500, sleep: async (ms) => waits.push(ms) });
  assert.deepEqual(waits, [1500]);
});

test('doppelte Modelle in der Liste werden nur einmal probiert', async () => {
  const { call, calls } = script({ status: 404 });
  const r = await runWithFallback(['A', 'A'], call, { sleep: noSleep });
  assert.equal(r.ok, false);
  assert.deepEqual(calls, ['A']);
});
