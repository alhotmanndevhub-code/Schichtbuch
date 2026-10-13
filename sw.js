/* Schichtbuch – Offline-Speicher. Bei jeder neuen Version VERSION hochzählen. */
const VERSION = '1.3.1';
const CACHE = 'schichtbuch-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './exceljs.min.js',
  './barlow-400.woff2', './barlow-500.woff2', './barlow-600.woff2', './barlow-700.woff2',
  './barlow-condensed-600.woff2', './barlow-condensed-700.woff2',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('schichtbuch-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Erst aus dem Speicher antworten (schnell und offline), die Startseite im Hintergrund auffrischen.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(isPage ? './index.html' : req, {ignoreSearch: true});
    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(isPage ? './index.html' : req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(fresh); return cached; }
    const res = await fresh;
    return res || new Response('Offline', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  })());
});
