import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativeApp, takePhoto, pickPhotos } from '../src/native-camera.js';

const bytes = new Uint8Array([1, 2, 3, 4]);
const okFetch = async () => ({ ok: true, blob: async () => new Blob([bytes], { type: 'image/jpeg' }) });

const fakeCap = (handlers) => ({ isNativePlatform: () => true, nativePromise: async (plugin, method, options) => handlers[`${plugin}.${method}`](options) });

test('isNativeApp: nur wenn Capacitor sich als native Plattform meldet', () => {
  assert.equal(isNativeApp({}), false);
  assert.equal(isNativeApp(undefined), false);
  assert.equal(isNativeApp({ isNativePlatform: () => true }), true);
  assert.equal(isNativeApp({ isNativePlatform: () => false }), false);
});

test('takePhoto: öffnet die Kamera direkt und liefert das Foto als File', async () => {
  let seen;
  const cap = fakeCap({ 'Camera.getPhoto': async (o) => { seen = o; return { webPath: 'http://localhost/_capacitor_file_/foto.jpg' }; } });
  const file = await takePhoto({ cap, fetchFn: okFetch });
  assert.equal(seen.source, 'CAMERA');
  assert.equal(seen.resultType, 'uri');
  assert.ok(file instanceof File);
  assert.equal(file.type, 'image/jpeg');
  assert.equal(file.size, 4);
});

test('takePhoto: Abbrechen ist kein Fehler (null)', async () => {
  const cap = fakeCap({ 'Camera.getPhoto': async () => { throw new Error('User cancelled photos app'); } });
  assert.equal(await takePhoto({ cap, fetchFn: okFetch }), null);
});

test('takePhoto: andere Fehler werden weitergegeben (z. B. Berechtigung verweigert)', async () => {
  const cap = fakeCap({ 'Camera.getPhoto': async () => { throw new Error('User denied access to camera'); } });
  await assert.rejects(() => takePhoto({ cap, fetchFn: okFetch }), /denied/);
});

test('pickPhotos: mehrere Fotos aus der Galerie, begrenzt auf limit', async () => {
  let seen;
  const cap = fakeCap({ 'Camera.pickImages': async (o) => { seen = o; return { photos: [{ webPath: 'http://localhost/a.jpg' }, { webPath: 'http://localhost/b.jpg' }] }; } });
  const files = await pickPhotos({ cap, fetchFn: okFetch, limit: 4 });
  assert.equal(seen.limit, 4);
  assert.equal(files.length, 2);
  assert.ok(files.every((f) => f instanceof File));
});

test('pickPhotos: Abbrechen ergibt eine leere Liste', async () => {
  const cap = fakeCap({ 'Camera.pickImages': async () => { throw new Error('User cancelled photos app'); } });
  assert.deepEqual(await pickPhotos({ cap, fetchFn: okFetch, limit: 4 }), []);
});

test('Foto lässt sich nicht laden: verständlicher Fehler', async () => {
  const cap = fakeCap({ 'Camera.getPhoto': async () => ({ webPath: 'http://localhost/x.jpg' }) });
  await assert.rejects(() => takePhoto({ cap, fetchFn: async () => ({ ok: false }) }), /Foto/);
});
