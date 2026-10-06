import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLabelResponse } from '../src/gemini-parse.js';

const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const good = { name: '삼각김밥', basis: 'perServing', servingGrams: 110, kcal: 180, protein: 4, carbs: 35, fat: 2 };

test('gültiges JSON -> ok', () => {
  const r = parseLabelResponse(wrap(JSON.stringify(good)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.label, good);
});

test('JSON im ```json-Zaun -> ok', () => {
  const r = parseLabelResponse(wrap('```json\n' + JSON.stringify(good) + '\n```'));
  assert.equal(r.ok, true);
  assert.equal(r.label.kcal, 180);
});

test('Text kein JSON -> Fehler', () => {
  assert.equal(parseLabelResponse(wrap('Das ist ein Keks.')).ok, false);
});

test('String-Zahlen werden Zahlen, "-" und leer werden null', () => {
  const r = parseLabelResponse(wrap(JSON.stringify({ ...good, kcal: '250', protein: '-', carbs: '', fat: '3,5' })));
  assert.equal(r.label.kcal, 250);
  assert.equal(r.label.protein, null);
  assert.equal(r.label.carbs, null);
  assert.equal(r.label.fat, 3.5);
});

test('unbekannte basis -> null', () => {
  const r = parseLabelResponse(wrap(JSON.stringify({ ...good, basis: 'pro Tüte' })));
  assert.equal(r.label.basis, null);
});

test('fehlende Felder -> null', () => {
  const r = parseLabelResponse(wrap('{"kcal": 100}'));
  assert.equal(r.ok, true);
  assert.equal(r.label.name, null);
  assert.equal(r.label.fat, null);
});

test('leere candidates -> Fehler', () => {
  assert.equal(parseLabelResponse({ candidates: [] }).ok, false);
  assert.equal(parseLabelResponse({}).ok, false);
});

test('blockReason -> Fehler mit Text', () => {
  const r = parseLabelResponse({ promptFeedback: { blockReason: 'SAFETY' } });
  assert.equal(r.ok, false);
  assert.match(r.error, /blockiert|SAFETY/i);
});

test('negative Werte -> null', () => {
  const r = parseLabelResponse(wrap(JSON.stringify({ ...good, kcal: -5 })));
  assert.equal(r.label.kcal, null);
});
