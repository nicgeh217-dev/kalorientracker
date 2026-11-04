import test from 'node:test';
import assert from 'node:assert/strict';
import { restNotifier } from '../src/native-rest.js';

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

function fakeCap({ display = 'granted', afterRequest = 'granted', fail = {} } = {}) {
  const calls = [];
  const cap = {
    isNativePlatform: () => true,
    nativePromise: async (plugin, method, options) => {
      assert.equal(plugin, 'LocalNotifications');
      calls.push([method, options]);
      if (fail[method]) throw new Error(fail[method]);
      if (method === 'checkPermissions') return { display };
      if (method === 'requestPermissions') return { display: afterRequest };
      return {};
    },
  };
  return { cap, calls, names: () => calls.map(([m]) => m) };
}

const opts = (cap) => ({ cap, now: () => NOW });

test('schedule: plant die Benachrichtigung exakt zum Pausenende, auch im Ruhezustand des Handys', async () => {
  const f = fakeCap();
  const r = restNotifier(opts(f.cap));
  await r.schedule(NOW + 90000);
  const [, o] = f.calls.find(([m]) => m === 'schedule');
  const n = o.notifications[0];
  assert.equal(n.title, 'Pause vorbei');
  assert.equal(n.schedule.at, new Date(NOW + 90000).toISOString());
  assert.equal(n.schedule.allowWhileIdle, true);
  assert.equal(n.channelId, 'pause');
});

test('schedule: legt den Kanal mit Vibration an, bevor geplant wird, und nur einmal', async () => {
  const f = fakeCap();
  const r = restNotifier(opts(f.cap));
  await r.schedule(NOW + 1000);
  await r.schedule(NOW + 2000);
  assert.equal(f.names().filter((m) => m === 'createChannel').length, 1);
  assert.ok(f.names().indexOf('createChannel') < f.names().indexOf('schedule'));
  assert.equal(f.calls.find(([m]) => m === 'createChannel')[1].vibration, true);
});

test('schedule: fragt nur, wenn Android noch nicht gefragt hat', async () => {
  const granted = fakeCap();
  await restNotifier(opts(granted.cap)).schedule(NOW + 1000);
  assert.equal(granted.names().includes('requestPermissions'), false);
  const prompt = fakeCap({ display: 'prompt' });
  await restNotifier(opts(prompt.cap)).schedule(NOW + 1000);
  assert.equal(prompt.names().includes('requestPermissions'), true);
  assert.equal(prompt.names().includes('schedule'), true);
});

test('schedule: abgelehnt heißt keine Benachrichtigung und keine erneute Nachfrage bei jeder Pause', async () => {
  const f = fakeCap({ display: 'prompt', afterRequest: 'denied' });
  const r = restNotifier(opts(f.cap));
  await r.schedule(NOW + 1000);
  await r.schedule(NOW + 2000);
  assert.equal(f.names().filter((m) => m === 'requestPermissions').length, 1);
  assert.equal(f.names().includes('schedule'), false);
});

test('schedule: ein Pausenende in der Vergangenheit plant nichts', async () => {
  const f = fakeCap();
  await restNotifier(opts(f.cap)).schedule(NOW - 1);
  assert.equal(f.names().includes('schedule'), false);
});

test('cancel: löscht dieselbe Benachrichtigung, die geplant wurde', async () => {
  const f = fakeCap();
  const r = restNotifier(opts(f.cap));
  await r.schedule(NOW + 1000);
  await r.cancel();
  const id = f.calls.find(([m]) => m === 'schedule')[1].notifications[0].id;
  assert.deepEqual(f.calls.find(([m]) => m === 'cancel')[1], { notifications: [{ id }] });
});

test('Reihenfolge: schnelles Planen und Löschen läuft in der Reihenfolge der Aufrufe', async () => {
  const f = fakeCap();
  const r = restNotifier(opts(f.cap));
  r.schedule(NOW + 1000);
  r.cancel();
  await r.schedule(NOW + 2000);
  const order = f.calls.filter(([m]) => m === 'schedule' || m === 'cancel').map(([m]) => m);
  assert.deepEqual(order, ['schedule', 'cancel', 'schedule']);
  assert.equal(f.calls.filter(([m]) => m === 'schedule')[1][1].notifications[0].schedule.at, new Date(NOW + 2000).toISOString());
});

test('Fehler im Plugin stören das Training nie', async () => {
  const f = fakeCap({ fail: { schedule: 'kaputt', cancel: 'kaputt' } });
  const r = restNotifier(opts(f.cap));
  await r.schedule(NOW + 1000);
  await r.cancel();
  const broken = fakeCap({ fail: { checkPermissions: 'kaputt' } });
  await restNotifier(opts(broken.cap)).schedule(NOW + 1000);
  assert.equal(broken.names().includes('schedule'), false);
});

test('im Browser passiert gar nichts', async () => {
  let called = false;
  const cap = { isNativePlatform: () => false, nativePromise: async () => { called = true; } };
  const r = restNotifier(opts(cap));
  await r.schedule(NOW + 1000);
  await r.cancel();
  const none = restNotifier({ cap: undefined, now: () => NOW });
  await none.schedule(NOW + 1000);
  assert.equal(called, false);
});
