// Monetag / PropellerAds Web Push Integration
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11787564
};
self.lary = "";
try {
  importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');
} catch (e) {}

// PWA Shell & Offline Support
var CACHE_NAME = 'n4u-pwa-v2';
var STATIC_ASSETS = [
  '/',
  '/index.html',
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
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
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

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Revalidate in background for local static assets
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
    }).catch(function() {
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html') || caches.match('/');
      }
    })
  );
});
