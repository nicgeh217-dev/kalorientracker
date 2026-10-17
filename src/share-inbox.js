// Holt Fotos und Text ab, die per "Teilen in die App" angekommen sind (vom Service Worker im Cache abgelegt).
const SHARE_CACHE = 'shared-v1';
const keyFor = (name) => new URL(`shared/${name}`, document.baseURI).href;

export async function takeSharedItems() {
  if (!('caches' in window)) return { files: [], text: '' };
  const cache = await caches.open(SHARE_CACHE);
  const metaRes = await cache.match(keyFor('meta'));
  if (!metaRes) return { files: [], text: '' };

  const { count = 0, text = '' } = await metaRes.json();
  const files = [];
  for (let i = 0; i < count; i += 1) {
    const res = await cache.match(keyFor(i));
    if (!res) continue;
    const blob = await res.blob();
    files.push(new File([blob], `geteilt-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
  }
  await caches.delete(SHARE_CACHE); // einmal abgeholt, dann weg
  return { files, text };
}
