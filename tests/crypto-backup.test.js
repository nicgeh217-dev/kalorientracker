import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptText, decryptText } from '../src/crypto-backup.js';

test('Roundtrip: mit dem richtigen Passwort kommt der Text zurück (auch Umlaute und Hangul)', async () => {
  const text = JSON.stringify({ name: 'Müsli 삼각김밥', kcal: 300 });
  const env = await encryptText(text, 'geheim-123');
  const back = await decryptText(env, 'geheim-123');
  assert.deepEqual(back, { ok: true, text });
});

test('Das Ergebnis ist ein JSON-Text ohne Klartext', async () => {
  const env = await encryptText('Haferflocken', 'pw');
  assert.equal(typeof env, 'string');
  assert.doesNotMatch(env, /Haferflocken/);
  const parsed = JSON.parse(env);
  assert.equal(parsed.v, 1);
  assert.ok(parsed.salt && parsed.iv && parsed.data);
});

test('Gleicher Text und Passwort ergeben jedes Mal andere Ausgabe (Zufall in Salz und IV)', async () => {
  assert.notEqual(await encryptText('x', 'pw'), await encryptText('x', 'pw'));
});

test('Falsches Passwort: ok false mit verständlichem Fehler, kein Wurf', async () => {
  const env = await encryptText('x', 'richtig');
  const r = await decryptText(env, 'falsch');
  assert.equal(r.ok, false);
  assert.match(r.error, /Passwort/);
});

test('Kaputte oder fremde Daten: ok false, kein Wurf', async () => {
  assert.equal((await decryptText('{nope', 'pw')).ok, false);
  assert.equal((await decryptText('{"v":9}', 'pw')).ok, false);
  assert.equal((await decryptText(JSON.stringify({ v: 1, salt: '!!', iv: '!!', data: '!!' }), 'pw')).ok, false);
});

test('Leeres Passwort wird abgelehnt', async () => {
  await assert.rejects(() => encryptText('x', ''), /Passwort/);
});
