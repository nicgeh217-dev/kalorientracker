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
