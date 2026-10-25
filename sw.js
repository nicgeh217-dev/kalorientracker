const CACHE = 'kalorientracker-v16';
const SHARE_CACHE = 'shared-v1'; // Fotos, die per "Teilen" in die App kamen (werden von der App abgeholt und gelöscht)
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/nav.js', './src/dom.js', './src/logic.js', './src/db.js',
  './src/views/today.js', './src/views/meal-form.js', './src/views/scan.js',
  './src/gemini.js', './src/gemini-parse.js', './src/gemini-retry.js', './src/overview.js', './src/state.js', './src/backup.js', './src/backup-share.js', './src/storage-persist.js', './src/welcome.js', './src/backup-import.js', './src/pet.js', './src/views/fox.js', './src/views/pet-sheet.js', './src/weight-input.js',
  './src/calendar.js', './src/amount.js', './src/notices.js', './src/views/history.js', './src/views/add-menu.js', './src/launch.js', './src/share-inbox.js',
  './fonts/barlow-condensed-700i.woff2', './fonts/barlow-condensed-800i.woff2', './fonts/figtree.woff2',
  './src/views/products.js', './src/views/product-form.js', './src/goals.js', './src/nutrients.js', './src/calorie.js', './src/views/calculator.js', './src/views/notes.js', './src/views/weight.js', './src/views/settings.js'
];

const shareUrl = (name) => new URL(`shared/${name}`, self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// "Teilen in die App": Android schickt die Fotos per POST an ./share-target. Wir legen sie in einen eigenen Cache
// und leiten zur App weiter, die sie dort abholt (siehe src/share-inbox.js).
async function handleShare(request) {
  try {
    const data = await request.formData();
    const files = data.getAll('photos').filter((f) => typeof f !== 'string');
    const text = [data.get('title'), data.get('text')].filter((v) => typeof v === 'string' && v.trim()).join(' ').trim();
    await caches.delete(SHARE_CACHE);
    const cache = await caches.open(SHARE_CACHE);
    await Promise.all(files.map((f, i) => cache.put(shareUrl(i), new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }))));
    await cache.put(shareUrl('meta'), new Response(JSON.stringify({ count: files.length, text })));
  } catch (err) {
    // Auch bei Fehlern zur App weiterleiten, sie zeigt dann "nichts empfangen".
  }
  return Response.redirect(new URL('./?action=shared', self.registration.scope).href, 303);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Netzwerk zuerst (immer die neueste Version), Cache als Offline-Fallback.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }) // immer beim Server nachfragen, nie 10 Minuten alten HTTP-Cache nutzen
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
