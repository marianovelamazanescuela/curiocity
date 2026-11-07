// Curiocity service worker: makes the app open fast and work without a connection.
// - Page (navigation): network first, cached copy if offline, so updates arrive right away.
// - Static files (/assets, /fonts, /icons, svg): cache first; Vite gives assets unique names per build.
// - /api/*: never cached here (the server has its own cache; answers depend on the photo).
const VERSION = 'v2';
const CACHE = `curiocity-${VERSION}`;
const PRECACHE = ['/', '/manifest.json', '/curiocity-logo.svg', '/curiocity-icon.svg', '/fonts/literata-latin.woff2', '/icons/icon-192x192.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('curiocity-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = url =>
  url.pathname.startsWith('/assets/') ||
  url.pathname.startsWith('/fonts/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.endsWith('.svg');

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ||
          fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
