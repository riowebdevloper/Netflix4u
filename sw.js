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
var CACHE_NAME = 'n4u-pwa-v1';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/netflix4u-net27.css',
  '/js/net27-core.js',
  '/js/net27-modal.js',
  '/js/manifest.json',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {});
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
      return cached || fetch(event.request);
    }).catch(function() {
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
