import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Wächter: Jede ausgelieferte Datei muss im Service-Worker-Cache stehen, sonst fehlt sie offline.
const sw = fs.readFileSync('sw.js', 'utf8');
const list = sw.slice(sw.indexOf('const ASSETS = ['), sw.indexOf('];', sw.indexOf('const ASSETS = [')));
const assets = new Set([...list.matchAll(/'(\.[^']*)'/g)].map((m) => m[1].replace(/^\.\//, '')));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name).split(path.sep).join('/')]);

test('sw.js cacht alle Dateien in src/, fonts/ und icons/', () => {
  const missing = [...walk('src'), ...walk('fonts'), ...walk('icons')].filter((f) => !assets.has(f));
  assert.deepEqual(missing, []);
});

test('sw.js cacht Startseite, Styles und Manifest', () => {
  for (const f of ['index.html', 'styles.css', 'manifest.webmanifest']) assert.ok(assets.has(f), f);
});

test('sw.js verweist nur auf vorhandene Dateien', () => {
  const ghost = [...assets].filter((f) => f && f !== '' && !fs.existsSync(f));
  assert.deepEqual(ghost, []);
});
