import test from 'node:test';
import assert from 'node:assert/strict';
import { PROMPT, lookupRequestBody } from '../src/gemini.js';
import { parseLookupResponse, parseLabelResponse } from '../src/gemini-parse.js';

const reply = (text, chunks = []) => ({ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: chunks } }] });
const web = (title, uri = `https://${title}/x`) => ({ web: { title, uri } });

test('Prompt: japanische Etiketten, 糖質 ist kein Zucker', () => {
  for (const term of ['栄養成分表示', 'エネルギー', 'たんぱく質', '脂質', '炭水化物', '食物繊維', '糖類', '糖質', '1個当たり', '食塩相当量']) {
    assert.ok(PROMPT.includes(term), term);
  }
  assert.match(PROMPT, /糖質[^\n]*(nicht|kein)[^\n]*Zucker/);
  assert.match(PROMPT, /糖質 \+ 食物繊維/);
});

test('lookupRequestBody: Google-Suche an, kein festes Antwortschema (verträgt sich nicht mit der Suche)', () => {
  const body = lookupRequestBody({ barcode: '4901234567894' });
  assert.deepEqual(body.tools, [{ google_search: {} }]);
  assert.equal(body.generationConfig?.responseSchema, undefined);
  assert.equal(body.generationConfig?.responseMimeType, undefined);
  const text = body.contents[0].parts.map((p) => p.text).join('\n');
  assert.ok(text.includes('4901234567894'));
  assert.match(text, /found/);
});

test('lookupRequestBody: Beschreibung statt Strichcode, z. B. ein Ketten-Gericht', () => {
  const text = lookupRequestBody({ query: 'Yoshinoya Gyudon Nami' }).contents[0].parts.map((p) => p.text).join('\n');
  assert.ok(text.includes('Yoshinoya Gyudon Nami'));
});

test('parseLookupResponse: JSON mitten im Text, Quellen aus der Google-Suche, höchstens drei, ohne Doppelte', () => {
  const json = JSON.stringify({ found: true, name: 'Lachs-Onigiri (鮭おにぎり)', basis: 'perServing', servingGrams: 110, kcal: 180, protein: 4.5, carbs: 38, fat: 1.2 });
  const r = parseLookupResponse(reply(`Hier die Werte:\n${json}\nQuelle: Lawson`, [web('lawson.co.jp'), web('lawson.co.jp', 'https://lawson.co.jp/y'), web('a.jp'), web('b.jp'), web('c.jp')]));
  assert.equal(r.ok, true);
  assert.equal(r.label.kcal, 180);
  assert.equal(r.label.source, 'web');
  assert.deepEqual(r.sources, ['lawson.co.jp', 'a.jp', 'b.jp']);
});

test('parseLookupResponse: nichts Sicheres gefunden ist ein eigener Fall', () => {
  const r = parseLookupResponse(reply('{"found": false}'));
  assert.equal(r.ok, false);
  assert.equal(r.notFound, true);
});

test('parseLookupResponse: ohne Kalorien kein Ergebnis', () => {
  const r = parseLookupResponse(reply('{"found": true, "name": "X", "kcal": null}'));
  assert.equal(r.ok, false);
  assert.equal(r.notFound, true);
});

test('parseLookupResponse: Fehler der Antwort werden durchgereicht', () => {
  assert.equal(parseLookupResponse({ promptFeedback: { blockReason: 'SAFETY' } }).ok, false);
  assert.equal(parseLookupResponse(reply('kein json')).ok, false);
});

test('parseLabelResponse: findet JSON auch mit Text davor und danach', () => {
  const r = parseLabelResponse(reply('Ergebnis: {"source":"label","kcal":120} fertig'));
  assert.equal(r.ok, true);
  assert.equal(r.label.kcal, 120);
});
