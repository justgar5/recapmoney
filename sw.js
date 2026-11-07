/* Service worker: membuat aplikasi bisa dibuka tanpa internet setelah pertama kali dimuat. */
const CACHE = 'rekap-pt-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './rekap.js',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ambil dari jaringan dulu supaya pembaruan kode langsung terbaca; jika offline, pakai cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const salinan = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, salinan));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
