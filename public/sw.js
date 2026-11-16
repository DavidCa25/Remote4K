// Service worker mínimo para que el navegador considere la app instalable.
// Solo se registra en contextos seguros (HTTPS o localhost). El control
// necesita el bridge en la red local, así que siempre va a la red y solo usa
// la caché como respaldo para el "cascarón" de la app.
const CACHE = 'remote4k-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/'))),
  );
});
