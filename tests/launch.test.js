import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseLaunchAction } from '../src/launch.js';

test('parseLaunchAction erkennt die Kurzbefehle', () => {
  assert.equal(parseLaunchAction('?action=scan'), 'scan');
  assert.equal(parseLaunchAction('?action=weight'), 'weight');
  assert.equal(parseLaunchAction('?action=shared'), 'shared');
  assert.equal(parseLaunchAction('?x=1&action=weight'), 'weight');
});

test('parseLaunchAction ignoriert Unbekanntes', () => {
  for (const s of ['', '?', '?action=', '?action=foo', '?action=SCAN', '?action=scan%20', '?actions=scan']) {
    assert.equal(parseLaunchAction(s), null, s);
  }
});

// Aufbau des Manifests: Kurzbefehle und Teilen-Ziel müssen zu den Seiten und zum Service Worker passen.
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('sw.js', 'utf8');

test('Manifest: Kurzbefehle "Foto scannen" und "Gewicht eintragen" mit gültigen Zielen und Icons', () => {
  const sc = manifest.shortcuts ?? [];
  assert.ok(sc.length >= 2);
  const names = sc.map((s) => s.name);
  assert.ok(names.includes('Foto scannen'));
  assert.ok(names.includes('Gewicht eintragen'));
  for (const s of sc) {
    assert.match(s.url, /^\.\/\?action=(scan|weight)$/, s.url);
    assert.equal(parseLaunchAction(s.url.slice(2)), s.url.endsWith('scan') ? 'scan' : 'weight');
    for (const icon of s.icons ?? []) assert.ok(fs.existsSync(icon.src), icon.src);
  }
});

test('Manifest: Teilen-Ziel nimmt Bilder per POST (multipart) an und der Service Worker bearbeitet den Pfad', () => {
  const t = manifest.share_target;
  assert.ok(t);
  assert.equal(t.method, 'POST');
  assert.equal(t.enctype, 'multipart/form-data');
  assert.ok(t.params.files.some((f) => f.name === 'photos' && f.accept.includes('image/*')));
  assert.ok(sw.includes(t.action.replace(/^\.\//, '')), 'sw.js muss den Pfad ' + t.action + ' kennen');
});

test('Service Worker: geteilte Fotos im eigenen Cache liegen lassen, nicht beim Aufräumen löschen', () => {
  assert.match(sw, /shared-v1/);
  assert.match(sw, /k !== SHARE_CACHE/);
});
