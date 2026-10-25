import test from 'node:test';
import assert from 'node:assert/strict';
import { dataFingerprint, isBackupDue, runOnlineBackup, setupOnlineBackup, restoreOnline } from '../src/online-backup.js';
import { buildBackup } from '../src/backup.js';
import { decryptText } from '../src/crypto-backup.js';
import { FILE_NAME } from '../src/gist.js';

const DAY = 24 * 3600 * 1000;
const data = (extra = {}) => ({
  products: [{ id: 1, name: 'Kimbap' }],
  meals: [{ id: 1, timestamp: '2026-10-06T12:00:00.000Z', dateKey: '2026-10-06', kcal: 300 }],
  weights: [], days: [], exercises: [], workouts: [], settings: { calorieGoal: 2000, geminiKey: 'GEHEIM' }, ...extra,
});
const cfg = { token: 'tok', gistId: 'g1', passphrase: 'pw' };
const reply = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

function makeDeps({ settings = {}, exported = data(), fetchFn, now = 10 * DAY } = {}) {
  const store = { settings: { ...settings } };
  return {
    store,
    deps: {
      exportAll: async () => exported,
      getSettings: async () => store.settings,
      saveSettings: async (s) => { store.settings = s; },
      fetchFn: fetchFn ?? (async () => reply(200, { id: 'g1' })),
      now: () => now,
    },
  };
}

test('Fingerprint ändert sich mit den Daten', () => {
  const a = dataFingerprint(data());
  assert.equal(a, dataFingerprint(data()));
  assert.notEqual(a, dataFingerprint(data({ meals: [...data().meals, { id: 2, timestamp: '2026-10-07T12:00:00.000Z', dateKey: '2026-10-07', kcal: 1 }] })));
});

test('isBackupDue: nur mit Konfiguration, Daten, neuem Stand und nach 24 Stunden', () => {
  const fp = dataFingerprint(data());
  const base = { config: { ...cfg, lastAt: 0, lastFingerprint: 'alt' }, fingerprint: fp, hasData: true, now: DAY };
  assert.equal(isBackupDue(base), true);
  assert.equal(isBackupDue({ ...base, config: null }), false);
  assert.equal(isBackupDue({ ...base, config: { ...cfg } }), true); // noch nie gesichert
  assert.equal(isBackupDue({ ...base, hasData: false }), false);
  assert.equal(isBackupDue({ ...base, config: { ...base.config, lastFingerprint: fp } }), false);
  assert.equal(isBackupDue({ ...base, now: DAY - 1 }), false);
  assert.equal(isBackupDue({ ...base, config: { ...cfg, passphrase: '' } }), false);
});

test('runOnlineBackup: verschlüsselt (kein Key, kein Klartext), lädt hoch, merkt sich Stand', async () => {
  let sent;
  const { deps, store } = makeDeps({
    settings: { onlineBackup: { ...cfg } },
    fetchFn: async (url, init) => { sent = JSON.parse(init.body).files[FILE_NAME].content; return reply(200, { id: 'g1' }); },
  });
  const r = await runOnlineBackup(deps);
  assert.equal(r.ok, true);
  assert.doesNotMatch(sent, /Kimbap|GEHEIM|calorieGoal/);
  const plain = await decryptText(sent, 'pw');
  assert.equal(plain.ok, true);
  assert.doesNotMatch(plain.text, /GEHEIM/);
  assert.equal(JSON.parse(plain.text).meals.length, 1);
  assert.equal(store.settings.onlineBackup.lastAt, 10 * DAY);
  assert.equal(store.settings.onlineBackup.lastError, null);
  assert.equal(store.settings.onlineBackup.lastFingerprint, dataFingerprint(data()));
});

test('runOnlineBackup: Fehler wird gemerkt statt geworfen, Konfiguration bleibt', async () => {
  const { deps, store } = makeDeps({ settings: { onlineBackup: { ...cfg } }, fetchFn: async () => reply(401, {}) });
  const r = await runOnlineBackup(deps);
  assert.equal(r.ok, false);
  assert.match(store.settings.onlineBackup.lastError, /Token/);
  assert.equal(store.settings.onlineBackup.token, 'tok');
  assert.equal(store.settings.onlineBackup.lastAt, undefined);
});

test('runOnlineBackup ohne Konfiguration tut nichts', async () => {
  let called = false;
  const { deps } = makeDeps({ fetchFn: async () => { called = true; return reply(200, {}); } });
  assert.equal((await runOnlineBackup(deps)).ok, false);
  assert.equal(called, false);
});

test('setupOnlineBackup: legt das Gist an und speichert Token, Nummer und Passwort', async () => {
  const { deps, store } = makeDeps({ fetchFn: async () => reply(201, { id: 'neu42' }) });
  const r = await setupOnlineBackup(deps, { token: 'tok', passphrase: 'langespasswort' });
  assert.deepEqual([r.ok, r.gistId], [true, 'neu42']);
  assert.equal(store.settings.onlineBackup.gistId, 'neu42');
  assert.equal(store.settings.onlineBackup.passphrase, 'langespasswort');
});

test('setupOnlineBackup: zu kurzes Passwort und fehlendes Token werden abgelehnt', async () => {
  const { deps } = makeDeps();
  assert.equal((await setupOnlineBackup(deps, { token: 'tok', passphrase: 'abc' })).ok, false);
  assert.equal((await setupOnlineBackup(deps, { token: '', passphrase: 'langespasswort' })).ok, false);
});

test('Sicherungsdatei enthält nie die Online-Sicherungs-Zugangsdaten', () => {
  const b = buildBackup(data({ settings: { onlineBackup: { token: 'tok', passphrase: 'pw' }, calorieGoal: 1 } }), new Date());
  assert.ok(!('onlineBackup' in b.settings));
});

test('restoreOnline: holt, entschlüsselt, spielt ein und aktiviert die Online-Sicherung wieder', async () => {
  const { encryptText } = await import('../src/crypto-backup.js');
  const content = await encryptText(JSON.stringify(buildBackup(data(), new Date())), 'pw');
  const replaced = [];
  const { deps, store } = makeDeps({ settings: { calorieGoal: 5 } });
  const r = await restoreOnline(deps, { token: 'tok', gistId: 'g1', passphrase: 'pw' }, async (d) => { replaced.push(d); },
    async () => reply(200, { files: { [FILE_NAME]: { content, truncated: false } } }));
  assert.equal(r.ok, true);
  assert.equal(replaced.length, 1);
  assert.equal(store.settings.onlineBackup.gistId, 'g1');
});

test('restoreOnline: falsches Passwort lässt alles unverändert', async () => {
  const { encryptText } = await import('../src/crypto-backup.js');
  const content = await encryptText('{}', 'richtig');
  let replaced = false;
  const { deps } = makeDeps();
  const r = await restoreOnline(deps, { token: 'tok', gistId: 'g1', passphrase: 'falsch' }, async () => { replaced = true; },
    async () => reply(200, { files: { [FILE_NAME]: { content, truncated: false } } }));
  assert.equal(r.ok, false);
  assert.equal(replaced, false);
});
