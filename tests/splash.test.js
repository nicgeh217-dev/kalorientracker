import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowSplash } from '../src/splash.js';

const cold = { navigationType: 'navigate', launchAction: null, reducedMotion: false, shownThisSession: false };

test('Kaltstart ohne Aktion zeigt den Splash', () => {
  assert.equal(shouldShowSplash(cold), true);
});

test('Start über Kurzbefehl oder Teilen zeigt ihn nicht', () => {
  assert.equal(shouldShowSplash({ ...cold, launchAction: 'scan' }), false);
  assert.equal(shouldShowSplash({ ...cold, launchAction: 'shared' }), false);
  assert.equal(shouldShowSplash({ ...cold, launchAction: 'weight' }), false);
});

test('reduzierte Bewegung, bereits gezeigt oder Neuladen zeigen ihn nicht', () => {
  assert.equal(shouldShowSplash({ ...cold, reducedMotion: true }), false);
  assert.equal(shouldShowSplash({ ...cold, shownThisSession: true }), false);
  assert.equal(shouldShowSplash({ ...cold, navigationType: 'reload' }), false);
});

test('Zurück/Vor zählt wie ein Start', () => {
  assert.equal(shouldShowSplash({ ...cold, navigationType: 'back_forward' }), true);
});
