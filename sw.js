// Velocis Typing — Service Worker for PWA Offline Mode
const CACHE_NAME = 'velocis-typing-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './auth.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png'
];

// Font URLs to cache
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=JetBrains+Mono:wght@400;700&family=Roboto+Mono:wght@400;700&family=Source+Code+Pro:wght@400;700&family=Ubuntu+Mono:wght@400;700&family=Inconsolata:wght@400;700&family=Space+Mono:wght@400;700&family=Courier+Prime:wght@400;700&family=IBM+Plex+Mono:wght@400;700&family=VT323&family=Share+Tech+Mono&family=Anonymous+Pro:wght@400;700&family=Cousine:wght@400;700&family=Cutive+Mono&family=PT+Mono&family=Nova+Mono&family=Syne+Mono&family=Oxygen+Mono&family=Overpass+Mono:wght@400;700&family=Red+Hat+Mono:wght@400;700&display=swap'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API calls, Cache-first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API calls: network-first with no cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        });
      })
    );
    return;
  }

  // Google Fonts: cache-first (they rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // All other requests: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        // Only cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If both network and cache fail, return offline page for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return cached;
      });

      return cached || fetchPromise;
    })
  );
});
