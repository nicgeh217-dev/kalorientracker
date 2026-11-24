import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease, isNewer, shouldCheck, shouldShow, checkForUpdate, RELEASES_URL } from '../src/update-check.js';

const release = (tag, assets = [{ name: 'Kalorientracker.apk', browser_download_url: 'https://github.com/x/y/releases/download/t/Kalorientracker.apk' }]) => ({
  tag_name: tag, name: `Version ${tag.slice(4)}`, html_url: 'https://github.com/x/y/releases/tag/' + tag, body: 'Neu: Karten', assets,
});

test('parseRelease: Version aus dem Tag, APK-Link, Seite, Notizen', () => {
  assert.deepEqual(parseRelease(release('app-17')), {
    build: 17, name: 'Version 17', apkUrl: 'https://github.com/x/y/releases/download/t/Kalorientracker.apk',
    pageUrl: 'https://github.com/x/y/releases/tag/app-17', notes: 'Neu: Karten',
  });
});

test('parseRelease: ohne APK im Anhang oder mit fremdem Tag kein Update', () => {
  assert.equal(parseRelease(release('app-17', [])), null);
  assert.equal(parseRelease(release('v2.0')), null);
  assert.equal(parseRelease(null), null);
  assert.equal(parseRelease({}), null);
});

test('parseRelease: nur Links zu github.com werden angenommen', () => {
  assert.equal(parseRelease(release('app-17', [{ name: 'a.apk', browser_download_url: 'https://evil.example/a.apk' }])), null);
});

test('isNewer: nur eine höhere Nummer, Entwicklungsstand (0) meldet nie', () => {
  assert.equal(isNewer(17, 16), true);
  assert.equal(isNewer(16, 16), false);
  assert.equal(isNewer(15, 16), false);
  assert.equal(isNewer(17, 0), false);
});

test('shouldCheck: höchstens alle 12 Stunden', () => {
  const now = Date.UTC(2026, 10, 24, 12);
  assert.equal(shouldCheck(null, now), true);
  assert.equal(shouldCheck(now - 11 * 3600000, now), false);
  assert.equal(shouldCheck(now - 12 * 3600000, now), true);
});

test('shouldShow: nicht, wenn diese Version schon weggeklickt wurde', () => {
  assert.equal(shouldShow({ build: 17 }, 17), false);
  assert.equal(shouldShow({ build: 18 }, 17), true);
  assert.equal(shouldShow({ build: 17 }, null), true);
  assert.equal(shouldShow(null, null), false);
});

test('checkForUpdate: neuere Version gefunden', async () => {
  let url = null;
  const fetchFn = async (u) => { url = u; return { ok: true, json: async () => release('app-17') }; };
  const r = await checkForUpdate({ current: 16, fetchFn });
  assert.equal(url, RELEASES_URL);
  assert.equal(r.ok, true);
  assert.equal(r.update.build, 17);
});

test('checkForUpdate: gleiche oder ältere Version ist kein Update', async () => {
  const fetchFn = async () => ({ ok: true, json: async () => release('app-16') });
  assert.deepEqual(await checkForUpdate({ current: 16, fetchFn }), { ok: true, update: null });
});

test('checkForUpdate: Fehler und offline werfen nie', async () => {
  assert.equal((await checkForUpdate({ current: 1, fetchFn: async () => { throw new Error('offline'); } })).ok, false);
  assert.equal((await checkForUpdate({ current: 1, fetchFn: async () => ({ ok: false, status: 403 }) })).ok, false);
  assert.equal((await checkForUpdate({ current: 1, fetchFn: async () => ({ ok: true, json: async () => { throw new Error('kaputt'); } }) })).ok, false);
});
