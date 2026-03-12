/*
  CORRECTED SERVICE WORKER - Daily Diary Vault
  Changes Made:
  - Added firebase-database-compat.js to cached assets
  - Implemented activate event for cache cleanup
  - Enhanced fetch strategy with better error handling
  - Added network-first strategy for HTML
  - Improved cache versioning
*/

const CACHE_NAME = 'diary-vault-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './firebase-app-compat.js',
  './firebase-database-compat.js' // Fixed: Added missing database library
];

// Install event - cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Fixed: Added activate event for cache cleanup
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME) // Remove old caches
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

// Fixed: Enhanced fetch strategy with better error handling
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for HTML (always get latest version when online)
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the new version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first for all other assets (faster performance)
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response; // Return cached version
        }
        
        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache if not a success response
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Cache the new resource
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });

            return response;
          })
          .catch(() => {
            // Network request failed and no cache available
            // Return a basic offline page or error response
            return new Response('Offline - content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});
