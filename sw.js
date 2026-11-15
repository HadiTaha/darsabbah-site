/* Offline support for the home-screen app: always try the network first so updates show at once,
   and fall back to the last saved copy when there is no connection. Family data stays encrypted. */
var CACHE = 'ds-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(['./', 'index.html', 'style.css', 'app.js', 'graph.js', 'maps.js', 'write.js', 'data.enc.js',
      'd3.min.js', 'marked.min.js', 'topojson-client.min.js', 'icon-180.png']);
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin && u.host.indexOf('fonts.') !== 0) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && (res.ok || res.type === 'opaque')) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () {
    return caches.match(r, {ignoreSearch: true}).then(function (m) { return m || (r.mode === 'navigate' ? caches.match('index.html') : undefined); });
  }));
});
