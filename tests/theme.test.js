import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeId, applyTheme } from '../src/theme.js';

const fakeRoot = () => ({ dataset: {} });
const fakeStore = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('THEMES: vier Design-Systeme mit Namen, Beschreibung und vier Vorschaufarben', () => {
  assert.deepEqual(THEMES.map((t) => t.id), ['klar', 'nacht', 'konbini', 'wald']);
  for (const t of THEMES) {
    assert.ok(t.label && t.note);
    assert.equal(t.swatch.length, 4);
    assert.match(t.bar, /^#[0-9a-f]{6}$/i);
  }
});

test('themeId: unbekannte oder fehlende Werte werden zu klar', () => {
  assert.equal(themeId('nacht'), 'nacht');
  assert.equal(themeId('lila'), 'klar');
  assert.equal(themeId(undefined), 'klar');
});

test('applyTheme: setzt data-theme und merkt sich die Wahl, klar entfernt das Attribut', () => {
  const root = fakeRoot(); const storage = fakeStore();
  assert.equal(applyTheme('wald', { root, storage }), 'wald');
  assert.equal(root.dataset.theme, 'wald');
  assert.equal(storage.getItem('theme'), 'wald');
  applyTheme('klar', { root, storage });
  assert.equal('theme' in root.dataset, false);
  assert.equal(storage.getItem('theme'), 'klar');
});

test('applyTheme: färbt die Statusleiste passend und übersteht gesperrten Speicher', () => {
  const root = fakeRoot(); let color = null;
  const meta = { setAttribute: (k, v) => { if (k === 'content') color = v; } };
  const storage = { setItem: () => { throw new Error('gesperrt'); } };
  assert.equal(applyTheme('nacht', { root, storage, meta }), 'nacht');
  assert.equal(color, THEMES.find((t) => t.id === 'nacht').bar);
});
