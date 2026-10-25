import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPersistence, persistenceStatus } from '../src/storage-persist.js';

test('requestPersistence: Chrome erlaubt es -> granted', async () => {
  assert.equal(await requestPersistence({ persist: async () => true }), 'granted');
});

test('requestPersistence: Chrome lehnt ab -> denied', async () => {
  assert.equal(await requestPersistence({ persist: async () => false }), 'denied');
});

test('requestPersistence: persist wirft -> denied', async () => {
  assert.equal(await requestPersistence({ persist: async () => { throw new Error('x'); } }), 'denied');
});

test('requestPersistence: nicht unterstützt -> unsupported', async () => {
  assert.equal(await requestPersistence(undefined), 'unsupported');
  assert.equal(await requestPersistence({}), 'unsupported');
});

test('persistenceStatus: persisted true/false', async () => {
  assert.equal(await persistenceStatus({ persisted: async () => true }), 'granted');
  assert.equal(await persistenceStatus({ persisted: async () => false }), 'not-granted');
});

test('persistenceStatus: nicht unterstützt oder wirft -> unsupported', async () => {
  assert.equal(await persistenceStatus(undefined), 'unsupported');
  assert.equal(await persistenceStatus({}), 'unsupported');
  assert.equal(await persistenceStatus({ persisted: async () => { throw new Error('x'); } }), 'unsupported');
});
