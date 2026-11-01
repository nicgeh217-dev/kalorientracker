import test from 'node:test';
import assert from 'node:assert/strict';
import { scanBarcode } from '../src/native-scanner.js';

const cap = (handlers) => ({ isNativePlatform: () => true, nativePromise: async (plugin, method, options) => handlers[`${plugin}.${method}`](options) });
const noWait = async () => {};

test('scanBarcode: liefert den gelesenen Code, Formate sind auf Produkt-Strichcodes begrenzt', async () => {
  let seen;
  const c = cap({
    'BarcodeScanner.isGoogleBarcodeScannerModuleAvailable': async () => ({ available: true }),
    'BarcodeScanner.scan': async (o) => { seen = o; return { barcodes: [{ rawValue: '8801073210080', format: 'EAN_13' }] }; },
  });
  assert.equal(await scanBarcode({ cap: c, sleep: noWait }), '8801073210080');
  assert.deepEqual(seen.formats.sort(), ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E']);
});

test('scanBarcode: Abbrechen (leere Liste oder Fehler "cancel") ergibt null', async () => {
  const base = { 'BarcodeScanner.isGoogleBarcodeScannerModuleAvailable': async () => ({ available: true }) };
  assert.equal(await scanBarcode({ cap: cap({ ...base, 'BarcodeScanner.scan': async () => ({ barcodes: [] }) }), sleep: noWait }), null);
  assert.equal(await scanBarcode({ cap: cap({ ...base, 'BarcodeScanner.scan': async () => { throw new Error('scan canceled.'); } }), sleep: noWait }), null);
});

test('scanBarcode: fehlt das Scanner-Modul, wird es installiert und abgewartet', async () => {
  let installed = false;
  let checks = 0;
  const c = cap({
    'BarcodeScanner.isGoogleBarcodeScannerModuleAvailable': async () => ({ available: installed && ++checks >= 2 }),
    'BarcodeScanner.installGoogleBarcodeScannerModule': async () => { installed = true; },
    'BarcodeScanner.scan': async () => ({ barcodes: [{ rawValue: '4006381333931' }] }),
  });
  let notified = false;
  assert.equal(await scanBarcode({ cap: c, sleep: noWait, onInstalling: () => { notified = true; } }), '4006381333931');
  assert.equal(installed, true);
  assert.equal(notified, true);
});

test('scanBarcode: Modul wird nie fertig -> verständlicher Fehler statt Endlosschleife', async () => {
  const c = cap({
    'BarcodeScanner.isGoogleBarcodeScannerModuleAvailable': async () => ({ available: false }),
    'BarcodeScanner.installGoogleBarcodeScannerModule': async () => {},
  });
  await assert.rejects(() => scanBarcode({ cap: c, sleep: noWait, maxPolls: 3 }), /Scanner/);
});

test('scanBarcode: andere Fehler werden weitergegeben', async () => {
  const c = cap({
    'BarcodeScanner.isGoogleBarcodeScannerModuleAvailable': async () => ({ available: true }),
    'BarcodeScanner.scan': async () => { throw new Error('Kamera nicht verfügbar'); },
  });
  await assert.rejects(() => scanBarcode({ cap: c, sleep: noWait }), /Kamera/);
});
