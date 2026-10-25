import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanGeminiKey } from '../src/gemini-key.js';

test('Schlüssel wird von Leerzeichen und Anführungszeichen befreit', () => {
  const key = 'XkXkXkXkXkXkXkXkXkXkXkXkXkXkXkXkXkXkXkXk';
  assert.deepEqual(cleanGeminiKey(`  ${key}\n`), { ok: true, key });
  assert.deepEqual(cleanGeminiKey(`"${key}"`), { ok: true, key });
});

test('leer, zu kurz oder mit Leerzeichen mittendrin wird mit verständlichem Text abgelehnt', () => {
  for (const bad of ['', '   ', 'AIza123', 'XkXkXkXkXkXkXkXkXkXk XkXkXkXkXkXkXkXkXkXk']) {
    const r = cleanGeminiKey(bad);
    assert.equal(r.ok, false, bad);
    assert.match(r.error, /Schlüssel/);
  }
});
