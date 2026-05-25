/* UNO Online — service worker
 * Caches the app shell so the lobby/auth screen still loads when offline,
 * but lets every API call and websocket bypass the cache (real-time game).
 */
'use strict';

const VERSION = 'uno-shell-v49';
const SHELL = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/styles/animations.css',
  '/ui/app.js',
  '/ui/modules/01-i18n.js',
  '/ui/modules/02-themes.js',
  '/ui/modules/03-events.js',
  '/ui/modules/04-voice-sound.js',
  '/ui/modules/05-chat.js',
  '/ui/modules/06-core.js',
  '/ui/modules/07-auth.js',
  '/ui/modules/08-socket.js',
  '/ui/modules/09-state.js',
  '/ui/modules/10-league.js',
  '/ui/modules/11-render.js',
  '/ui/modules/12-lobby.js',
  '/ui/modules/13-battlepass.js',
  '/ui/modules/14-game.js',
  '/ui/modules/15-cinematic.js',
  '/ui/modules/16-emoji.js',
  '/ui/modules/17-room-code.js',
  '/ui/modules/18-friends.js',
  '/ui/modules/19-competitions.js',
  '/ui/modules/20-room-scene.js',
  '/ui/modules/21-lobby-scene.js',
  '/ui/modules/22-parallax.js',
  '/ui/modules/24-atmosphere.js',
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
