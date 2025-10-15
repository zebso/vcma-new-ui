/* v1.0 */
var CACHE_PREFIX = 'cc-pwa';
var STATIC_CACHE = CACHE_PREFIX + '-static-v1';
var RUNTIME_CACHE = CACHE_PREFIX + '-runtime-v1';
var OFFLINE_URL = '/pages/offline.html';

var PRECACHE = [
  '/user',
  '/dealer',
  '/manifest/manifest.json',
  OFFLINE_URL
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        return cache.addAll(PRECACHE);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys
        .filter(function(k) {
          return [STATIC_CACHE, RUNTIME_CACHE].indexOf(k) === -1;
        })
        .map(function(k) {
          return caches.delete(k);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.indexOf('/api/') === 0) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function() {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname) ||
      url.pathname === '/user' ||
      url.pathname === '/dealer') {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(res) {
      return caches.open(RUNTIME_CACHE).then(function(cache) {
        cache.put(request, res.clone());
        return res;
      });
    });
  });
}

function networkFirst(request) {
  return fetch(request).then(function(res) {
    return caches.open(RUNTIME_CACHE).then(function(cache) {
      cache.put(request, res.clone());
      return res;
    });
  }).catch(function(e) {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match(OFFLINE_URL);
      throw e;
    });
  });
}