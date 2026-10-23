// Service worker: keeps the app shell available with no signal so a
// canvasser can reopen Starbase mid-walk. API calls always go to the network
// (door knocks made offline are queued by the app itself, not here).

const CACHE = 'starbase-v1';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest', '/icons/icon.svg',
  '/js/app.js', '/js/api.js', '/js/ui.js', '/js/maps.js', '/js/canvass.js', '/js/admin.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Network first so deploys show up immediately; cache when offline.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
