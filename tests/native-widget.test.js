import test from 'node:test';
import assert from 'node:assert/strict';
import { pushToWidget, takeWidgetCamera, widgetKcal } from '../src/native-widget.js';

const fakeCap = (result = {}) => {
  const calls = [];
  return {
    calls,
    cap: { isNativePlatform: () => true, nativePromise: async (plugin, method, options) => { calls.push([plugin, method, options]); return result; } },
  };
};

test('widgetKcal: ganze Kalorien der Tagessumme', () => {
  assert.equal(widgetKcal([{ kcal: 100.4 }, { kcal: 200.3 }]), 301);
  assert.equal(widgetKcal([]), 0);
});

test('pushToWidget: schickt nur die Tageszahl und das Datum', async () => {
  const f = fakeCap();
  await pushToWidget({ kcal: 1240, dateKey: '2026-11-04' }, { cap: f.cap });
  assert.deepEqual(f.calls, [['KalorienWidget', 'update', { kcal: 1240, dateKey: '2026-11-04' }]]);
});

test('pushToWidget: im Browser passiert nichts, und Fehler stören die App nie', async () => {
  let called = false;
  await pushToWidget({ kcal: 1, dateKey: 'x' }, { cap: { isNativePlatform: () => false, nativePromise: async () => { called = true; } } });
  assert.equal(called, false);
  await pushToWidget({ kcal: 1, dateKey: 'x' }, { cap: { isNativePlatform: () => true, nativePromise: async () => { throw new Error('kaputt'); } } });
});

test('takeWidgetCamera: meldet, ob das Widget die Kamera angefordert hat', async () => {
  assert.equal(await takeWidgetCamera({ cap: fakeCap({ camera: true }).cap }), true);
  assert.equal(await takeWidgetCamera({ cap: fakeCap({ camera: false }).cap }), false);
  const f = fakeCap({ camera: true });
  await takeWidgetCamera({ cap: f.cap });
  assert.deepEqual(f.calls[0].slice(0, 2), ['KalorienWidget', 'takeCameraRequest']);
});

test('takeWidgetCamera: im Browser und bei Fehlern false', async () => {
  assert.equal(await takeWidgetCamera({ cap: { isNativePlatform: () => false } }), false);
  assert.equal(await takeWidgetCamera({ cap: { isNativePlatform: () => true, nativePromise: async () => { throw new Error('kaputt'); } } }), false);
});

test('widgetPayload: Tageswerte, Ziele und Körperwerte für die Widgets', async () => {
  const { widgetPayload } = await import('../src/native-widget.js');
  const p = widgetPayload({
    dateKey: '2026-11-24',
    meals: [{ kcal: 500, protein: 30, carbs: 50, fat: 10 }, { kcal: 612.4, protein: 20.5, carbs: 80, fat: 15 }],
    settings: { calorieGoal: 2200, proteinGoal: 110 },
    vitals: [{ dateKey: '2026-11-23', steps: 999 }, { dateKey: '2026-11-24', steps: 5500.4, sleepMin: 372, restingHr: 54.2 }],
  });
  assert.equal(p.kcal, 1112); assert.equal(p.goal, 2200); assert.equal(p.protein, 51); assert.equal(p.carbs, 130); assert.equal(p.fat, 25);
  assert.equal(p.proteinGoal, 110); assert.equal(p.steps, 5500); assert.equal(p.sleepMin, 372); assert.equal(p.restingHr, 54);
});

test('widgetPayload: ohne Ziel und ohne Körperwerte sind die Felder 0, nie NaN', async () => {
  const { widgetPayload } = await import('../src/native-widget.js');
  const p = widgetPayload({ dateKey: 'd', meals: [], settings: {}, vitals: [] });
  for (const v of Object.values({ ...p, dateKey: 0 })) assert.equal(v, 0);
});

test('takeWidgetAction: liefert die Aktion genau einmal, im Browser und bei Fehlern null', async () => {
  const { takeWidgetAction } = await import('../src/native-widget.js');
  const f = fakeCap({ action: 'barcode' });
  assert.equal(await takeWidgetAction({ cap: f.cap }), 'barcode');
  assert.deepEqual(f.calls[0].slice(0, 2), ['KalorienWidget', 'takeAction']);
  assert.equal(await takeWidgetAction({ cap: fakeCap({ action: '' }).cap }), null);
  assert.equal(await takeWidgetAction({ cap: fakeCap({ action: 'hacken' }).cap }), null);
  assert.equal(await takeWidgetAction({ cap: { isNativePlatform: () => false } }), null);
  assert.equal(await takeWidgetAction({ cap: { isNativePlatform: () => true, nativePromise: async () => { throw new Error('x'); } } }), null);
});

test('widgetPayload: Ziele kommen aus nutrientTargets, wie in der App', async () => {
  const { widgetPayload } = await import('../src/native-widget.js');
  const p = widgetPayload({ dateKey: 'd', meals: [], vitals: [], settings: { calorieGoal: 2000, targets: { fat: 60 } } });
  assert.equal(p.proteinGoal, 100); assert.equal(p.carbsGoal, 250); assert.equal(p.fatGoal, 60);
});
