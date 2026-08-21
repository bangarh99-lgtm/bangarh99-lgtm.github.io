const CACHE_NAME = 'easy-attendance-v3';
const APP_SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Cache each app-shell file individually (instead of cache.addAll, which is
// all-or-nothing) so that if any single file fails to fetch — a brief
// network hiccup, a slow connection — the rest still get cached and the
// service worker still installs successfully. With addAll, one failed file
// silently aborted the ENTIRE install, leaving the app with no offline
// cache at all even though it looked like it had loaded fine online.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((url) =>
        fetch(url)
          .then((res) => { if (res && res.ok) return cache.put(url, res); })
          .catch(() => {})
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first for the app shell: always try to fetch the latest deployed
// version first, and only fall back to the cached copy when offline. This
// keeps the app fully usable offline (same as before) while making sure a
// new Netlify deploy is picked up immediately instead of staying stuck on
// an old cached version.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((fresh) => {
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh.clone()));
      return fresh;
    }).catch(() =>
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // Offline and this exact URL was never cached — for a page
        // navigation (e.g. the browser requesting "/" while we cached
        // "./index.html"), fall back to the cached app shell so opening
        // the app offline still works.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      })
    )
  );
});
