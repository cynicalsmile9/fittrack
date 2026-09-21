/* FitTrack service worker: кэширует оболочку приложения.
   Активируется только при HTTPS (localhost или хостинг). */
var CACHE = 'fittrack-v4';
var V = '?v=3';
var ASSETS = [
  './', './index.html', './style.css' + V,
  './js/db.js' + V, './js/core.js' + V, './js/screen-dashboard.js' + V, './js/screen-food.js' + V,
  './js/screen-workout.js' + V, './js/screen-analytics.js' + V, './js/screen-history.js' + V,
  './js/screen-settings.js' + V,
  './manifest.webmanifest' + V, './icon-192.png', './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* cache:'reload' — берём файлы с сервера, минуя HTTP-кэш браузера,
         иначе новая версия SW может закэшировать старые файлы */
      return Promise.all(ASSETS.map(function (a) {
        return fetch(new Request(a, { cache: 'reload' })).then(function (r) { return c.put(a, r); });
      }));
    }).then(function () { return self.skipWaiting(); })
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
