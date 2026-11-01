// Strichcode-Scanner der Android-App (ML Kit über das Capacitor-Plugin). In der PWA im Browser gibt es ihn nicht.
// Auf Android braucht der fertige Scanner-Dialog ein kleines Google-Modul. Es wird beim ersten Mal automatisch nachgeladen.

const FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'];
const wasCancelled = (e) => /cancel/i.test(String(e?.message ?? e));
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(cap, method, options) {
  if (cap?.nativePromise) return cap.nativePromise('BarcodeScanner', method, options);
  const fn = cap?.Plugins?.BarcodeScanner?.[method];
  if (!fn) throw new Error('Der Strichcode-Scanner ist hier nicht verfügbar.');
  return fn.call(cap.Plugins.BarcodeScanner, options);
}

// Roher Strichcode als Text oder null, wenn abgebrochen. Wirft bei Fehlern.
export async function scanBarcode({ cap = globalThis.Capacitor, sleep = defaultSleep, onInstalling = null, maxPolls = 60, pollMs = 1000 } = {}) {
  const { available } = await call(cap, 'isGoogleBarcodeScannerModuleAvailable');
  if (!available) {
    onInstalling?.();
    await call(cap, 'installGoogleBarcodeScannerModule');
    let ready = false;
    for (let i = 0; i < maxPolls && !ready; i += 1) {
      await sleep(pollMs);
      ready = Boolean((await call(cap, 'isGoogleBarcodeScannerModuleAvailable')).available);
    }
    if (!ready) throw new Error('Der Scanner konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es später noch einmal.');
  }
  try {
    const { barcodes } = await call(cap, 'scan', { formats: FORMATS });
    return barcodes?.[0]?.rawValue ?? null;
  } catch (e) {
    if (wasCancelled(e)) return null;
    throw e;
  }
}
