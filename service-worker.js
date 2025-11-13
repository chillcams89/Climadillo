const CACHE_NAME = 'climadillo-v1.0.1';
const CACHE_STATIC = 'climadillo-static-v1';
const CACHE_DYNAMIC = 'climadillo-dynamic-v1';

// Archivos críticos para cachear durante la instalación
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './js/script.js',
  './js/pwa-install.js',
  './manifest.json',
  './images/icono.png',
  './images/apple-touch-icon.png',
  './images/favicon.svg',
  './images/favicon.ico',
  './images/favicon-96x96.png',
  './images/web-app-manifest-192x192.png',
  './images/web-app-manifest-512x512.png'
];

// Archivos opcionales (cachear si están disponibles)
const optionalCache = [
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon.png',
  './images/soleado.png',
  './images/noche.png',
  './images/nublado.png',
  './images/cieloAzul.jpg',
  './images/nocheNegra.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js'
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    Promise.all([
      // Cachear archivos críticos
      caches.open(CACHE_STATIC).then(cache => {
        console.log('📦 Cacheando archivos críticos...');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, { cache: 'reload' });
        }));
      }),
      // Intentar cachear archivos opcionales (sin fallar si alguno no existe)
      caches.open(CACHE_STATIC).then(cache => {
        console.log('📦 Intentando cachear archivos opcionales...');
        return Promise.allSettled(
          optionalCache.map(url => {
            return cache.add(url).catch(err => {
              console.log(`⚠️ No se pudo cachear ${url}:`, err.message);
            });
          })
        );
      })
    ]).then(() => {
      console.log('✅ Service Worker instalado correctamente');
      // Forzar activación inmediata
      return self.skipWaiting();
    })
  );
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker: Activando...');
  
  event.waitUntil(
    Promise.all([
      // Limpiar cachés antiguos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_STATIC && cacheName !== CACHE_DYNAMIC) {
              console.log('🗑️ Eliminando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar control inmediato de todas las páginas
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activado y en control');
    })
  );
});

// ==================== FETCH - ESTRATEGIAS DE CACHÉ ====================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar peticiones no HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Ignorar chrome-extension y otras URLs especiales
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // ESTRATEGIA 1: Network First para APIs y archivos PHP
  if (request.url.includes('.php') || request.url.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // ESTRATEGIA 2: Cache First para recursos estáticos
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // ESTRATEGIA 3: Stale While Revalidate para páginas HTML
  if (request.destination === 'document' || request.url.endsWith('.html')) {
    event.respondWith(staleWhileRevalidateStrategy(request));
    return;
  }

  // Por defecto: Network First
  event.respondWith(networkFirstStrategy(request));
});

// ==================== ESTRATEGIAS DE CACHÉ ====================

// Network First: Intenta red primero, caché como fallback
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Si la respuesta es válida, cachearla
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('⚠️ Red no disponible, buscando en caché:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si es una petición de API, devolver error JSON
    if (request.url.includes('.php') || request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ 
          error: 'Sin conexión',
          message: 'No hay conexión a internet. Por favor intenta más tarde.'
        }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 503
        }
      );
    }
    
    // Para otros recursos, devolver error
    return new Response('Sin conexión', { status: 503 });
  }
}

// Cache First: Busca en caché primero, red como fallback
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('⚠️ Error al obtener recurso:', request.url);
    return new Response('Recurso no disponible', { status: 404 });
  }
}

// Stale While Revalidate: Devuelve caché y actualiza en segundo plano
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      const cache = caches.open(CACHE_DYNAMIC);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// ==================== MENSAJES DEL CLIENTE ====================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Saltando espera - activando nueva versión');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('🗑️ Limpiando todas las cachés...');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// ==================== SINCRONIZACIÓN EN SEGUNDO PLANO ====================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-weather-data') {
    console.log('🔄 Sincronizando datos del clima...');
    event.waitUntil(syncWeatherData());
  }
});

async function syncWeatherData() {
  try {
    // Aquí puedes agregar lógica para sincronizar datos cuando vuelva la conexión
    console.log('✅ Sincronización completada');
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
}

console.log('🌦️ Service Worker de Climadillo cargado');