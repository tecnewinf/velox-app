const CACHE_NAME = 'osm-ride-v2';
const ASSETS = [
  'index.html',
  'offline.html',
  'manifest.json',
  'icon-192.png',
  'img/logo.png',
  'img/favicon.ico'
];

// Instala o service worker e armazena os arquivos locais essenciais em cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepta requisições de rede para retornar o cache caso esteja offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request).then((response) => {
        if (response) {
          return response;
        }
        // Se for uma navegação de página HTML e falhar na rede, exibe offline.html
        if (e.request.mode === 'navigate') {
          return caches.match('offline.html');
        }
      });
    })
  );
});


