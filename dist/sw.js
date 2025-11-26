/**
 * Service Worker para CasiListo
 * Implementa cache-first para assets hasheados de Vite y network-first para navegaciones.
 * Al instalar, precachea los assets esenciales via la lista en /asset-manifest.json (si existe)
 * o bien hace cache-on-fetch para /assets/*.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `casilisto-cache-${CACHE_VERSION}`;
const ASSET_CACHE = `casilisto-assets-${CACHE_VERSION}`;

// URLs base que siempre precacheamos
const OFFLINE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

/**
 * Intenta obtener un manifiesto de assets generado en build (opcional).
 * Si existe, retorna un array de rutas; si no, retorna [].
 */
async function fetchAssetManifest() {
  try {
    const resp = await fetch('/asset-manifest.json');
    if (!resp.ok) return [];
    const data = await resp.json();
    // El manifiesto puede ser un array o un objeto con keys
    if (Array.isArray(data)) return data;
    return Object.values(data).filter((v) => typeof v === 'string');
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precachear URLs base
      await cache.addAll(OFFLINE_URLS);

      // Intentar precachear assets de Vite desde manifiesto
      const assetUrls = await fetchAssetManifest();
      if (assetUrls.length > 0) {
        const assetCache = await caches.open(ASSET_CACHE);
        // Ignorar errores individuales para no bloquear install
        await Promise.allSettled(assetUrls.map((url) => assetCache.add(url)));
      }

      // Forzar activación inmediata
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar caches viejos
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      );
      // Tomar control de clientes abiertos
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests del mismo origen
  if (url.origin !== self.location.origin) return;

  // Navegaciones: network-first, fallback a index.html cacheado
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // Cachear navegación exitosa
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets hasheados de Vite (/assets/*): cache-first (inmutables por hash)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Otros recursos estáticos: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
