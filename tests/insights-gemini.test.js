import test from 'node:test';
import assert from 'node:assert/strict';
import { insightsRequestBody, parseInsightsResponse, INSIGHTS_PROMPT } from '../src/gemini.js';
import { buildBackup } from '../src/backup.js';

const finding = { id: 'sleep_kcal', text: 'Gegessene Kalorien nach kurzen und langen Nächten', unit: 'kcal', thresholds: [6, 7], a: { label: 'nach Nächten unter 6 h', mean: 2400, n: 6 }, b: { label: 'nach Nächten ab 7 h', mean: 1900, n: 6 }, diff: 500, pct: 26 };
const reply = (obj) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

test('Prompt: freundlich, ohne Druck, nur gelieferte Zahlen, kein Gewicht, keine Medizin', () => {
  for (const s of ['freundlich', 'ohne Druck', 'Wenn du magst', 'solltest', 'Gewicht', 'Ursache', 'nur Zahlen']) assert.ok(INSIGHTS_PROMPT.includes(s), s);
});

test('insightsRequestBody: nur die Ergebnisse, festes Antwortschema', () => {
  const body = insightsRequestBody([finding]);
  const text = body.contents[0].parts.map((p) => p.text).join('\n');
  assert.ok(text.includes('"sleep_kcal"'));
  assert.ok(text.includes('2400'));
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(text), false, 'keine Daten');
  const schema = body.generationConfig.responseSchema;
  assert.deepEqual(Object.keys(schema.properties).sort(), ['observations', 'suggestions']);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
});

test('parseInsightsResponse: höchstens je 3, leere Texte fallen weg', () => {
  const obs = Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, text: `Text ${i}` }));
  const r = parseInsightsResponse(reply({ observations: [...obs, { title: 'x', text: '' }], suggestions: [{ text: 'Wenn du magst, …' }, { text: '  ' }] }));
  assert.equal(r.ok, true);
  assert.equal(r.observations.length, 3);
  assert.deepEqual(r.suggestions, [{ text: 'Wenn du magst, …' }]);
});

test('parseInsightsResponse: kaputte Antwort ist ein Fehler', () => {
  assert.equal(parseInsightsResponse({ candidates: [{ content: { parts: [{ text: 'kein json' }] } }] }).ok, false);
  assert.equal(parseInsightsResponse({ promptFeedback: { blockReason: 'SAFETY' } }).ok, false);
});

test('buildBackup: Zusammenhänge sind Gerätezustand und nicht in der Sicherung', () => {
  const b = buildBackup({ products: [], meals: [], weights: [], settings: { insights: { consented: true, observations: [] }, calorieGoal: 2000 } }, new Date());
  assert.equal('insights' in b.settings, false);
});
