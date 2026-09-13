// Monetag / PropellerAds Web Push Integration
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11787564
};
self.lary = "";
try {
  importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');
} catch (e) {}

// PWA Shell & Offline Support (Network-First for HTML to guarantee fresh updates)
var CACHE_NAME = 'n4u-pwa-v6';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/?source=pwa',
  '/css/netflix4u-net27.css',
  '/css/Layout.CBW6-iGy.css',
  '/css/index.P3dZcbru.css',
  '/js/net27-core.js',
  '/js/net27-modal.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Caching failed for asset:', url, err);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-First for Navigation & HTML documents: Ensures users ALWAYS get live site updates
  var isNavOrHtml = event.request.mode === 'navigate' ||
                    url.pathname === '/' ||
                    url.pathname === '/index.html' ||
                    url.pathname.endsWith('.html');

  if (isNavOrHtml) {
    event.respondWith(
      fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match(event.request, { ignoreSearch: true }).then(function(cached) {
          return cached || caches.match('/index.html') || caches.match('/');
        });
      })
    );
    return;
  }

  // Network-First for JS and CSS files with version queries or live paths
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')) {
    event.respondWith(
      fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match(event.request, { ignoreSearch: true });
      })
    );
    return;
  }

  // Stale-While-Revalidate for other static assets (images, icons, fonts)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function(cached) {
      if (cached) {
        fetch(event.request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(function() {});
        return cached;
      }
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, toCache);
        });
        return response;
      });
    })
  );
});
