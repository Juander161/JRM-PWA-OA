// Service worker mínimo para que la PWA arranque sin red.
//
// Estrategia: stale-while-revalidate sobre peticiones GET del mismo origen.
// Se sirve lo que haya en caché (arranque instantáneo) y en paralelo se pide
// la versión nueva para la próxima vez. No se pre-cachea una lista fija de
// archivos porque Vite les pone un hash en el nombre en cada compilación.
//
// Los datos de trabajo NO pasan por aquí: el inventario vive en IndexedDB y
// las solicitudes se leen de la carpeta local en cada sesión.

const CACHE = 'order-approval-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  if (new URL(peticion.url).origin !== self.location.origin) return;

  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const enCache = await cache.match(peticion);

      const desdeRed = fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok) cache.put(peticion, respuesta.clone());
          return respuesta;
        })
        .catch(() => enCache);

      return enCache || desdeRed;
    })()
  );
});
