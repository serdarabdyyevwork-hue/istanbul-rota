// İstanbul Rota service worker: keeps the app and city data working offline.
// Bump CACHE when you change index.html, app.js or the icons.
const CACHE = 'rota-v8';
// The big map file (maps/istanbul.pmtiles) is NOT in this list. The app saves it in its own
// cache, 'rota-map-v1', only when the user taps "Download map".
const MAP_CACHE = 'rota-map-v1';
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const RANGES = ['0-255', '256-511', '768-1023', '8192-8447'];
const SHELL = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'data/istanbul.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'maps/sprites/light.json',
  'maps/sprites/light.png',
  'maps/sprites/light@2x.json',
  'maps/sprites/light@2x.png',
  ...FONTS.flatMap((f) => RANGES.map((r) => `maps/fonts/${f}/${r}.pbf`)),
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/pmtiles@4.4.1/dist/pmtiles.js',
  'https://unpkg.com/@protomaps/basemaps@5.7.2/dist/basemaps.js'
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's own HTTP cache, so a new version never saves old files.
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MAP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The map file is read in small pieces (Range requests). Let those go straight to the
  // network; when offline, the app reads the saved copy itself instead of asking for it.
  if (url.pathname.endsWith('.pmtiles')) return;

  // City data: try the network first so updates arrive, fall back to the saved copy.
  if (url.pathname.endsWith('/data/istanbul.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: saved copy first, refreshed in the background.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return cached || network;
    })
  );
});
