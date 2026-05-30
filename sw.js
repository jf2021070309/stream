const CACHE_NAME = 'radio-xero-v1';
const urlsToCache = [
  './',
  './index.html',
  './icon-512.png',
  './logo xero.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Fallback en caso de que algún archivo no exista localmente, 
        // evita que el worker falle por completo al instalar
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => console.warn('No se pudo cachear:', url, err));
          })
        );
      })
  );
});

self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') return;
  // Ignorar peticiones al stream de audio para no afectar la reproducción en vivo
  if (event.request.url.includes('zeno.fm') || event.request.url.includes('stream.zeno.fm')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Si está en caché, devuélvelo
        }
        // Si no está en caché, búscalo en la red
        return fetch(event.request).catch(err => {
          console.warn('Error de fetch o sin conexión:', err);
        });
      })
  );
});
