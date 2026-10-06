const CACHE = 'kalorientracker-v4';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/nav.js', './src/dom.js', './src/logic.js', './src/db.js',
  './src/views/today.js', './src/views/meal-form.js', './src/views/scan.js',
  './src/gemini.js', './src/gemini-parse.js', './src/backup.js', './src/weight-input.js',
  './src/views/products.js', './src/views/weight.js', './src/views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Netzwerk zuerst (immer die neueste Version), Cache als Offline-Fallback.
  e.respondWith(
    fetch(e.request)
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
