/* FitTrack service worker: кэширует оболочку приложения.
   Активируется только при HTTPS (localhost или хостинг). */
var CACHE = 'fittrack-v1';
var ASSETS = [
  './', './index.html', './style.css',
  './js/db.js', './js/core.js', './js/screen-dashboard.js', './js/screen-food.js',
  './js/screen-workout.js', './js/screen-analytics.js', './js/screen-history.js',
  './js/screen-settings.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return resp;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
