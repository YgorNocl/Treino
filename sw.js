const CACHE_NAME = 'treino-cache-v35';
const MEDIA_CACHE = 'treino-media-v1';
const MEDIA_HOST = 'raw.githubusercontent.com';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './css/panel-modals.css',
  './js/app.js',
  './js/data.js',
  './js/sync.js',
  './js/utils.js',
  './js/body-map.js',
  './js/rest-timer.js',
  './js/share-card.js',
  './js/set-editor.js',
  './js/dialog.js',
  './js/back-nav.js',
  './js/summary.js',
  './css/calisthenics.css',
  './js/calisthenics.js',
  './js/calisthenics-data.js',
  './js/calisthenics-store.js',
  './js/calisthenics-charts.js',
  './js/calisthenics-poses.js',
  './js/calisthenics-panels.js',
  './manifest.json'
];
const STATIC_ASSETS = [
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

function isAppShellRequest(url) {
  return APP_SHELL.some(path => url.endsWith(path.replace('./', '/')) || url.endsWith(path.replace('./', '')));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        // cache: 'reload' ignora o cache HTTP do navegador — sem isso, uma versão
        // antiga de algum arquivo já em cache do navegador podia ser gravada aqui
        // e ficar "presa" até o cache do próprio navegador expirar.
        [...APP_SHELL, ...STATIC_ASSETS].map(url => fetch(url, { cache: 'reload' }).then(res => cache.put(url, res)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== MEDIA_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => self.skipWaiting())
    );
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Fotos dos exercícios (GitHub): guardadas na primeira visualização, pra
  // aparecerem mesmo sem internet na academia.
  if (url.hostname === MEDIA_HOST && url.pathname.endsWith('.jpg')) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(cache =>
        cache.match(event.request).then(cached => cached || fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  const networkFirst = isAppShellRequest(url.pathname);

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cachedResponse => {
        const networkFetch = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    )
  );
});