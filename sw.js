// sw.js
// Service Worker para Ecosistema Z12 - Intercepción y Caché

const CACHE_NAME = 'z12-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './score.html',
  './pitchProcessor.js',
  './biblioteca_z12.json',
  './manifest.json'
];

// Instalación: Pre-caché del ecosistema
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Z12 SW] Precaching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activación: Purga de cachés obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Z12 SW] Purgando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Intercepción: Estrategia Stale-While-Revalidate para JSON, Cache-First para el resto
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Si se pide la biblioteca maestra, intentamos red para tener la última versión, si falla usamos caché
  if (requestUrl.pathname.endsWith('biblioteca_z12.json')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Estrategia general: Cache-First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devuelve del caché si existe, si no, busca en la red
        return response || fetch(event.request).then((fetchResponse) => {
          // Solo guardamos en caché peticiones válidas (no extensiones chrome, etc.)
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return fetchResponse;
        });
      })
  );
});
