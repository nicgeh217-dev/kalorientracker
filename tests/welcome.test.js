import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWelcome } from '../src/welcome.js';

const empty = { products: [], meals: [], weights: [], settings: { calorieGoal: null, geminiKey: null } };

test('leere Daten -> Karte wird gezeigt', () => {
  assert.equal(shouldShowWelcome(empty), true);
});

test('nur ein Gemini-Key gesetzt zählt noch als leer', () => {
  assert.equal(shouldShowWelcome({ ...empty, settings: { calorieGoal: null, geminiKey: 'K' } }), true);
});

test('eine Mahlzeit, ein Produkt oder ein Gewicht blendet die Karte aus', () => {
  assert.equal(shouldShowWelcome({ ...empty, meals: [{ id: 1 }] }), false);
  assert.equal(shouldShowWelcome({ ...empty, products: [{ id: 1 }] }), false);
  assert.equal(shouldShowWelcome({ ...empty, weights: [{ date: '2026-10-01', kg: 70 }] }), false);
});

test('Kalorienziel, Fuchs oder Rechner-Profil blenden die Karte aus', () => {
  assert.equal(shouldShowWelcome({ ...empty, settings: { calorieGoal: 2000 } }), false);
  assert.equal(shouldShowWelcome({ ...empty, settings: { pet: { enabled: true } } }), false);
  assert.equal(shouldShowWelcome({ ...empty, settings: { calcProfile: { sex: 'm' } } }), false);
});

test('"Neu starten" (welcomeDismissed) blendet die Karte dauerhaft aus', () => {
  assert.equal(shouldShowWelcome({ ...empty, settings: { welcomeDismissed: true } }), false);
});
