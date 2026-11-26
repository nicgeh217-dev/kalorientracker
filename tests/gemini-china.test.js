import test from 'node:test';
import assert from 'node:assert/strict';
import { PROMPT, lookupRequestBody } from '../src/gemini.js';
import { parseLabelResponse, parseLookupResponse } from '../src/gemini-parse.js';

const reply = (obj) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
const label = (extra) => parseLabelResponse(reply({ source: 'label', basis: 'per100g', ...extra })).label;

test('Prompt: chinesische Etiketten, vereinfacht und traditionell', () => {
  for (const term of ['营养成分表', '能量', '千焦', '蛋白质', '脂肪', '碳水化合物', '膳食纤维', '钠', 'NRV', '每100克', '每100毫升', '每份', '净含量', '熱量', '大卡', '蛋白質', '每一份量']) {
    assert.ok(PROMPT.includes(term), term);
  }
});

test('Prompt: kJ wird nicht von Gemini umgerechnet, sondern als kj geliefert', () => {
  assert.match(PROMPT, /kj/);
  assert.match(PROMPT, /rechne[^\n]*nicht[^\n]*um|App rechnet/);
});

test('nur kJ auf dem Etikett: die App rechnet in kcal um', () => {
  assert.equal(label({ kj: 1850 }).kcal, 442);
  assert.equal(label({ kcal: null, kj: '1850' }).kcal, 442);
});

test('kJ versehentlich auch als kcal eingetragen: wird erkannt und umgerechnet', () => {
  assert.equal(label({ kcal: 1850, kj: 1850 }).kcal, 442);
});

test('steht kcal da, gilt die Angabe; ohne beides bleibt kcal leer', () => {
  assert.equal(label({ kcal: 440, kj: 1850 }).kcal, 440);
  assert.equal(label({ kcal: 120 }).kcal, 120);
  assert.equal(label({}).kcal, null);
});

test('unsicher gelesene Energie in kJ markiert das Kalorienfeld', () => {
  assert.deepEqual(label({ kj: 1850, uncertain: ['kj'] }).uncertain, ['kcal']);
});

test('Schätzung und Netzsuche akzeptieren ebenfalls kJ', () => {
  assert.equal(parseLabelResponse(reply({ source: 'estimate', kj: 2092 })).label.kcal, 500);
  assert.equal(parseLookupResponse(reply({ found: true, name: 'X', basis: 'per100g', kj: 418 })).label.kcal, 100);
});

test('Nachschlagen: chinesische Ketten und kJ werden genannt', () => {
  const text = lookupRequestBody({ query: '全家 饭团' }).contents[0].parts.map((p) => p.text).join('\n');
  for (const term of ['China', '全家', '罗森', 'kj']) assert.ok(text.includes(term), term);
});

test('Region nicht unterstützt: klare Meldung statt "Key ungültig", später nachholbar', async () => {
  const { analyzeFood, lookupOnline } = await import('../src/gemini.js');
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' } }) });
  try {
    const r = await analyzeFood({ hint: 'Baozi mit Schwein' }, 'k');
    assert.equal(r.reason, 'region');
    assert.match(r.error, /Land|Region/);
    assert.doesNotMatch(r.error, /Key ist ungültig/);
    assert.match((await lookupOnline({ query: '全家 饭团' }, 'k')).error, /Land|Region/);
  } finally {
    globalThis.fetch = original;
  }
});
