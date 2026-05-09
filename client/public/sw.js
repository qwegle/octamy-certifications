// Octamy minimal service worker — app-shell + runtime caching for static assets.
// Designed to fail-open: never blocks navigation if cache fails.
const CACHE = 'octamy-v1';
const SHELL = ['/', '/favicon.svg', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache API or auth requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Cache-first for /assets/ (hashed by Vite)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match('/')))
    );
    return;
  }

  // Network-first for HTML navigations, fallback to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/'))
    );
  }
});
