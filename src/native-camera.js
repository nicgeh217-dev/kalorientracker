// Kamera und Galerie in der Android-App (Capacitor): Die native Kamera öffnet direkt, statt über den Datei-Dialog der WebView.
// In der Browser-Version (PWA) wird nichts davon benutzt, dort bleibt der normale Datei-Dialog.
// Capacitor liefert ohne Bundler `nativePromise`, damit sprechen wir die eingebauten Plugins direkt an.

const FAIL_MSG = 'Das Foto konnte nicht geladen werden.';

export const isNativeApp = (cap = globalThis.Capacitor) => Boolean(cap?.isNativePlatform?.());

const wasCancelled = (e) => /cancel/i.test(String(e?.message ?? e));

async function call(cap, plugin, method, options) {
  if (cap?.nativePromise) return cap.nativePromise(plugin, method, options);
  const fn = cap?.Plugins?.[plugin]?.[method];
  if (!fn) throw new Error(`${plugin}.${method} ist nicht verfügbar`);
  return fn.call(cap.Plugins[plugin], options);
}

async function toFile(webPath, fetchFn, name) {
  const res = await fetchFn(webPath);
  if (!res?.ok) throw new Error(FAIL_MSG);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

// Ein Foto mit der Kamera. null, wenn abgebrochen.
export async function takePhoto({ cap = globalThis.Capacitor, fetchFn = (...a) => fetch(...a) } = {}) {
  let photo;
  try {
    photo = await call(cap, 'Camera', 'getPhoto', { source: 'CAMERA', resultType: 'uri', quality: 90, correctOrientation: true, saveToGallery: false });
  } catch (e) {
    if (wasCancelled(e)) return null;
    throw e;
  }
  return toFile(photo.webPath, fetchFn, 'foto.jpg');
}

// Mehrere Fotos aus der Galerie. Leere Liste, wenn abgebrochen.
export async function pickPhotos({ cap = globalThis.Capacitor, fetchFn = (...a) => fetch(...a), limit = 4 } = {}) {
  let res;
  try {
    res = await call(cap, 'Camera', 'pickImages', { quality: 90, limit, correctOrientation: true });
  } catch (e) {
    if (wasCancelled(e)) return [];
    throw e;
  }
  const photos = res?.photos ?? [];
  return Promise.all(photos.map((p, i) => toFile(p.webPath, fetchFn, `foto-${i + 1}.jpg`)));
}
