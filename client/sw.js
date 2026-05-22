/* UNO Online — service worker
 * Caches the app shell so the lobby/auth screen still loads when offline,
 * but lets every API call and websocket bypass the cache (real-time game).
 */
'use strict';

const VERSION = 'uno-shell-v14';
const SHELL = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/styles/animations.css',
  '/ui/app.js',
  '/manifest.json',
  '/icon.svg',
  '/lobby-bg.png',
  '/game-bg.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll(SHELL).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache API or socket.io traffic — game state must be live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // Network-first for the HTML document so updates roll out fast,
  // fall back to cache when offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(VERSION).then((cache) => cache.put('/index.html', clone));
        return res;
      }).catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
