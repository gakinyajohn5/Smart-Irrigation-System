/* Offline support: app shell is cached; AI/voice functions always go to the network. */
const CACHE = 'smart-irrigation-v7';
const SHELL = ['/', '/index.html', '/live.js', '/tour.js', '/farmplus.js', '/twin.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/.netlify/functions/')) return;           // never cache API calls
  if (url.origin === location.origin) {
    // network first so updates show up, cache as fallback when offline
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('/index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    // fonts: cache first
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
  }
});
