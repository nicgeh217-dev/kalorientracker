import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Wächter: Im Repo darf nichts stehen, das wie ein Google-API-Schlüssel aussieht (auch kein erfundener Testwert).
// Das Muster wird zusammengesetzt, damit diese Datei selbst nicht danach aussieht.
const PATTERN = new RegExp('AI' + 'za' + '[0-9A-Za-z_-]{30,}');
const SKIP = new Set(['node_modules', '.git', '.superpowers']);
const TEXT = /\.(js|json|html|css|md|webmanifest|cjs|mjs|txt)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

test('keine Datei im Repo enthält etwas, das wie ein Google-API-Schlüssel aussieht', () => {
  const hits = walk('.').filter((p) => PATTERN.test(readFileSync(p, 'utf8')));
  assert.deepEqual(hits, []);
});
