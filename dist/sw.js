/**
 * Service Worker para CasiListo
 * Implementa cache-first para assets hasheados de Vite y network-first para navegaciones.
 * Al instalar, precachea los assets esenciales via la lista en /asset-manifest.json (si existe)
 * o bien hace cache-on-fetch para /assets/*.
 * 
 * También maneja sincronización offline con Background Sync API.
 */

const CACHE_VERSION = 'v3';
const CACHE_NAME = `casilisto-cache-${CACHE_VERSION}`;
const ASSET_CACHE = `casilisto-assets-${CACHE_VERSION}`;
const SYNC_QUEUE_NAME = 'casilisto-sync-queue';
const SYNC_TAG = 'casilisto-sync';

// P2: Límite de entradas en cache de assets
const MAX_ASSET_CACHE_SIZE = 50;

// P3: URLs base que siempre precacheamos (incluyendo iconos)
const OFFLINE_URLS = [
  '/', 
  '/index.html', 
  '/manifest.webmanifest', 
  '/icon.svg',
  '/favicon.ico'
];

// IndexedDB para cola de sincronización offline
const DB_NAME = 'casilisto-sw-db';
const STORE_NAME = 'sync-queue';

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function addToSyncQueue(requestData) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({
      ...requestData,
      timestamp: Date.now()
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getSyncQueue() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function clearSyncQueue() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function removeFromSyncQueue(id) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

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

  // No cachear peticiones que no sean GET (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') return;

  // No interceptar llamadas a la API
  if (url.pathname.startsWith('/api/')) return;

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
  // P2: Con límite de tamaño de cache
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        
        const response = await fetch(request);
        if (response.ok) {
          // P2: Verificar tamaño del cache antes de añadir
          const keys = await cache.keys();
          if (keys.length >= MAX_ASSET_CACHE_SIZE) {
            // Eliminar las entradas más antiguas (primeras en la lista)
            const keysToDelete = keys.slice(0, Math.floor(MAX_ASSET_CACHE_SIZE / 4));
            await Promise.all(keysToDelete.map(key => cache.delete(key)));
          }
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
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Background Sync: procesar cola cuando hay conexión
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const queue = await getSyncQueue();
  
  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body
      });
      
      if (response.ok) {
        await removeFromSyncQueue(item.id);
        // Notificar a los clientes que se sincronizó
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_COMPLETED',
            timestamp: Date.now()
          });
        });
      }
    } catch (err) {
      console.error('Error procesando sync queue:', err);
      // Mantener en cola para reintentar
    }
  }
}

// Escuchar mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'QUEUE_SYNC') {
    // Agregar request a la cola offline
    addToSyncQueue(event.data.request)
      .then(() => {
        // Registrar Background Sync si está disponible
        if ('sync' in self.registration) {
          return self.registration.sync.register(SYNC_TAG);
        }
      })
      .catch(err => console.error('Error encolando sync:', err));
  }
  
  if (event.data && event.data.type === 'FORCE_SYNC') {
    // Forzar procesamiento de cola
    processSyncQueue();
  }
});
