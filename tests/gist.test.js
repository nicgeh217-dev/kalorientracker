import test from 'node:test';
import assert from 'node:assert/strict';
import { createGist, updateGist, readGist, FILE_NAME } from '../src/gist.js';

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

test('createGist: privat, richtige Datei, Token im Header, liefert die ID', async () => {
  let seen;
  const fetchFn = async (url, init) => { seen = { url, init }; return reply(201, { id: 'abc123' }); };
  const r = await createGist('tok', 'INHALT', fetchFn);
  assert.deepEqual(r, { ok: true, id: 'abc123' });
  assert.equal(seen.url, 'https://api.github.com/gists');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.public, false);
  assert.equal(body.files[FILE_NAME].content, 'INHALT');
});

test('updateGist: PATCH auf die ID', async () => {
  let seen;
  const r = await updateGist('tok', 'abc123', 'NEU', async (url, init) => { seen = { url, init }; return reply(200, { id: 'abc123' }); });
  assert.equal(r.ok, true);
  assert.equal(seen.url, 'https://api.github.com/gists/abc123');
  assert.equal(seen.init.method, 'PATCH');
  assert.equal(JSON.parse(seen.init.body).files[FILE_NAME].content, 'NEU');
});

test('readGist: liest den Inhalt, bei gekürztem Inhalt über raw_url', async () => {
  const direct = await readGist('tok', 'id', async () => reply(200, { files: { [FILE_NAME]: { content: 'A', truncated: false } } }));
  assert.deepEqual(direct, { ok: true, text: 'A' });
  const calls = [];
  const viaRaw = await readGist('tok', 'id', async (url) => {
    calls.push(url);
    return url.endsWith('/raw') ? reply(200, 'VOLL') : reply(200, { files: { [FILE_NAME]: { content: 'te', truncated: true, raw_url: 'https://gist.githubusercontent.com/x/raw' } } });
  });
  assert.deepEqual(viaRaw, { ok: true, text: 'VOLL' });
  assert.equal(calls.length, 2);
});

test('Fehler werden verständlich: 401, 404, Netzwerk, keine Sicherungsdatei', async () => {
  assert.match((await createGist('t', 'x', async () => reply(401, {}))).error, /Token/);
  assert.match((await readGist('t', 'id', async () => reply(404, {}))).error, /nicht gefunden/);
  assert.match((await updateGist('t', 'id', 'x', async () => { throw new TypeError('offline'); })).error, /Internet/);
  assert.match((await readGist('t', 'id', async () => reply(200, { files: {} }))).error, /Sicherung/);
});

test('Leeres Token oder leere ID ruft gar nicht erst das Netz', async () => {
  let called = false;
  const f = async () => { called = true; return reply(200, {}); };
  assert.equal((await createGist('', 'x', f)).ok, false);
  assert.equal((await readGist('t', '', f)).ok, false);
  assert.equal(called, false);
});
