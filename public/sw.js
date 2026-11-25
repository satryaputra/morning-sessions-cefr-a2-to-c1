const CACHE_NAME = 'vocab-shell-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    const html = await (await cache.match('/index.html')).text();
    const bundledAssets = [...new Set(Array.from(
      html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
      (match) => match[1]
    ))];
    await cache.addAll(bundledAssets);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(
          (key) =>
            (key.startsWith('pagikata-shell-') || key.startsWith('vocab-shell-')) &&
            key !== CACHE_NAME
        )
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/index.html', response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const isBundledAsset = url.pathname.startsWith('/assets/');
  event.respondWith(
    caches.match(request, { ignoreVary: isBundledAsset }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then(async (response) => {
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      });
    })
  );
});
