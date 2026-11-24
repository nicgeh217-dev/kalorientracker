import test from 'node:test';
import assert from 'node:assert/strict';
import { typicalRange, lastValues, phaseBar, trackPosition } from '../src/vitals-view.js';

const TODAY = '2026-11-24';
const key = (i) => { const d = new Date(2026, 10, 24 - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const days = (values) => values.map((v, i) => ({ dateKey: key(i), steps: v }));
const steps = (d) => d.steps;

test('typicalRange: mittlere Hälfte (25 bis 75 %) der letzten 30 Tage ohne heute', () => {
  const list = days([9999, ...Array.from({ length: 20 }, (_, i) => 1000 + i * 100)]); // heute 9999 zählt nicht
  const r = typicalRange(list, steps, TODAY);
  assert.equal(r.n, 20);
  assert.deepEqual([r.lo, r.hi, r.median], [1475, 2425, 1950]);
});

test('typicalRange: erst ab 7 Tagen, sonst null', () => {
  assert.equal(typicalRange(days([5, 1, 2, 3, 4, 5, 6]), steps, TODAY), null);
  assert.notEqual(typicalRange(days([5, 1, 2, 3, 4, 5, 6, 7]), steps, TODAY), null);
});

test('typicalRange: Tage ohne Wert und Tage außerhalb von 30 Tagen zählen nicht', () => {
  const list = [...days([0, 10, 10, 10, 10, 10, 10, 10]), { dateKey: key(40), steps: 99999 }, { dateKey: key(20) }];
  const r = typicalRange(list, steps, TODAY);
  assert.deepEqual([r.n, r.lo, r.hi], [7, 10, 10]);
});

test('lastValues: 7 Tage bis heute, fehlende Tage sind null', () => {
  const list = [{ dateKey: key(0), steps: 70 }, { dateKey: key(2), steps: 50 }, { dateKey: key(6), steps: 10 }];
  assert.deepEqual(lastValues(list, steps, TODAY), [10, null, null, null, 50, null, 70]);
  assert.equal(lastValues(list, steps, TODAY, 3).length, 3);
});

test('phaseBar: Anteile der Schlafphasen, null ohne Phasen', () => {
  const bar = phaseBar({ sleepDeep: 60, sleepRem: 90, sleepLight: 210, sleepAwake: 30 });
  assert.deepEqual(bar.map((p) => [p.key, p.min]), [['deep', 60], ['rem', 90], ['light', 210], ['awake', 30]]);
  assert.equal(Math.round(bar.reduce((s, p) => s + p.frac, 0) * 1000) / 1000, 1);
  assert.equal(bar[1].frac, 0.2308);
  assert.equal(phaseBar({ sleepMin: 400 }), null);
  assert.equal(phaseBar(undefined), null);
});

test('phaseBar: nur vorhandene Phasen, keine leeren Streifen', () => {
  assert.deepEqual(phaseBar({ sleepDeep: 60, sleepLight: 60 }).map((p) => p.key), ['deep', 'light']);
});

test('trackPosition: Spanne und Punkt auf einer Skala von 0 bis 1, Ausreißer bleiben im Bild', () => {
  const p = trackPosition(8000, { lo: 5000, hi: 7000 }, [4000, 9000, 6000]);
  assert.ok(p.bandStart > 0 && p.bandEnd < 1 && p.bandStart < p.bandEnd);
  assert.ok(p.dot > p.bandEnd && p.dot <= 1);
  const out = trackPosition(20000, { lo: 5000, hi: 7000 }, [4000]);
  assert.ok(out.dot > 0.9 && out.dot <= 1, 'Ausreißer liegt am Rand, bleibt aber im Bild');
  assert.equal(trackPosition(5, null, []), null);
});
