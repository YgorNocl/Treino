// A versão do app vem de js/version.js (mesmo arquivo que a página usa). Mudar a
// versão lá muda o nome do cache e faz o celular baixar tudo de novo.
importScripts('./js/version.js');

const CACHE_NAME = `treino-cache-${self.APP_VERSION}`;
const MEDIA_CACHE = 'treino-media-v1';
// Firebase (backup) e fontes: arquivos de outros domínios, guardados para o app
// abrir completo sem internet. As URLs do Firebase têm versão, nunca mudam.
const EXT_CACHE = 'treino-ext-v1';
const MEDIA_HOST = 'raw.githubusercontent.com';
const FIREBASE_PREFIX = 'https://www.gstatic.com/firebasejs/';
const FIREBASE_FILES = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './css/panel-modals.css',
  './css/calisthenics.css',
  './js/version.js',
  './js/rescue.js',
  './js/app.js',
  './js/data.js',
  './js/catalog.js',
  './js/templates.js',
  './js/modules.js',
  './js/thumb.js',
  './js/sync.js',
  './js/utils.js',
  './js/body-map.js',
  './js/rest-timer.js',
  './js/wake-lock.js',
  './js/calendar.js',
  './js/sheet-drag.js',
  './js/share-card.js',
  './js/set-editor.js',
  './js/dialog.js',
  './js/back-nav.js',
  './js/summary.js',
  './js/update.js',
  './js/calisthenics.js',
  './js/calisthenics-data.js',
  './js/calisthenics-store.js',
  './js/calisthenics-charts.js',
  './js/calisthenics-poses.js',
  './js/calisthenics-panels.js',
  './js/run.js',
  './js/run-store.js',
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

// Com internet ruim (academia no subsolo), esperar a rede em cada arquivo
// deixava o app demorando para abrir. A página espera a rede até este tempo;
// passou disso, abre na hora pelo que está guardado e se atualiza por trás.
const NAV_TIMEOUT_MS = 3000;
// Para cada página aberta: 'network' (abriu pela rede) ou 'cache' (abriu pelo
// que estava guardado). Os arquivos da página seguem a mesma origem, para não
// misturar arquivos de versões diferentes.
const clientModes = new Map();

// Caminhos exatos dos arquivos do app. (Antes a comparação por "termina com"
// incluía './' → '', e todo arquivo do site contava como arquivo do app.)
const SHELL_PATHS = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).pathname));
function isAppShellRequest(pathname) {
  return SHELL_PATHS.has(pathname);
}

async function putIfOk(cacheName, request, response) {
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  }
}

// Mantém o SW vivo até terminar de guardar algo em segundo plano.
function extend(event, promise) {
  const safe = promise.catch(() => null);
  try { event.waitUntil(safe); } catch (e) { /* evento já encerrado: segue sem esperar */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // cache: 'reload' ignora o cache HTTP do navegador — sem isso, uma versão
    // antiga de algum arquivo já em cache do navegador podia ser gravada aqui
    // e ficar "presa" até o cache do próprio navegador expirar.
    await Promise.all([...APP_SHELL, ...STATIC_ASSETS].map(async url => {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      await cache.put(url, res);
    }));
    // Firebase: se falhar agora, é guardado na primeira vez que for usado.
    const ext = await caches.open(EXT_CACHE);
    await Promise.all(FIREBASE_FILES.map(url => ext.match(url).then(hit => hit || fetch(url).then(res => (res.ok ? ext.put(url, res) : null)))).map(p => p.catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => ![CACHE_NAME, MEDIA_CACHE, EXT_CACHE].includes(key)).map(key => caches.delete(key))
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

// Guardado primeiro; a rede só se ainda não tiver (fotos, Firebase, arquivos das fontes).
function cacheFirst(event, cacheName) {
  event.respondWith(
    caches.open(cacheName).then(cache =>
      cache.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }))
    )
  );
}

// Responde com o guardado e atualiza por trás (CSS das fontes).
function staleWhileRevalidate(event, cacheName) {
  event.respondWith(
    caches.open(cacheName).then(cache =>
      cache.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
        if (cached) {
          extend(event, network);
          return cached;
        }
        return network;
      })
    )
  );
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(() => resolve(null), ms));
}

async function handleNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request, { ignoreSearch: true }) || await cache.match('./index.html');
  const network = fetch(event.request).then(response => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  if (!cached) return network;
  const fresh = await Promise.race([network.catch(() => null), timeout(NAV_TIMEOUT_MS)]);
  if (fresh && fresh.ok) {
    clientModes.set(event.resultingClientId, 'network');
    return fresh;
  }
  clientModes.set(event.resultingClientId, 'cache');
  extend(event, network);
  return cached;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Fotos dos exercícios (GitHub): guardadas na primeira visualização, pra
  // aparecerem mesmo sem internet na academia.
  if (url.hostname === MEDIA_HOST && url.pathname.endsWith('.jpg')) {
    cacheFirst(event, MEDIA_CACHE);
    return;
  }
  if (event.request.url.startsWith(FIREBASE_PREFIX)) {
    cacheFirst(event, EXT_CACHE);
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) {
    if (url.hostname === 'fonts.googleapis.com') staleWhileRevalidate(event, EXT_CACHE);
    else cacheFirst(event, EXT_CACHE);
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isAppShellRequest(url.pathname)) {
    // Página aberta pelo guardado: os arquivos dela também vêm do guardado
    // (mesma versão), e a rede só entra se faltar algum.
    if (clientModes.get(event.clientId) === 'cache') {
      event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request))
      );
      return;
    }
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          extend(event, putIfOk(CACHE_NAME, event.request, networkResponse.clone()));
          return networkResponse;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
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
