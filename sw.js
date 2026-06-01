const CACHE_NAME = 'modulus-z12-v1.0.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json'
];

// Instalación y almacenamiento en caché estricto
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(ASSETS_TO_CACHE))
        .then(() => self.skipWaiting())
    );
});

// Limpieza de cachés obsoletas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    return self.clients.claim();
});

// Interceptor de peticiones (Estrategia: Cache First, fallback a Red)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
});
