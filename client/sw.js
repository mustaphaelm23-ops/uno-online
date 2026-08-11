/* RONDAONE — service worker
 * Caches the app shell so the lobby/auth screen still loads when offline,
 * but lets every API call and websocket bypass the cache (real-time game).
 */
'use strict';

const VERSION = 'rondaone-shell-v725';
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
  '/ui/modules/23-shop.js',
  '/ui/modules/24-atmosphere.js',
  '/ui/modules/26-offers.js',
  '/ui/modules/27-music.js',
  '/ui/modules/28-quickchat.js',
  '/ui/modules/29-dms.js',
  '/ui/modules/30-spin.js',
  '/ui/modules/31-notifs.js',
  '/ui/modules/32-browse-rooms.js',
  '/ui/modules/33-match-intro.js',
  '/ui/modules/34-mobile-rotate.js',
  '/ui/modules/35-cosmetics.js',
  '/ui/modules/36-ronda.js',
  '/ui/modules/38-dama.js',
  '/ui/modules/39-chess.js',
  '/manifest.json',
  '/icon.svg',
  '/coin.svg',
  '/diamond.svg',
  '/lobby-bg.png',
  '/game-bg.png',
  '/ronda-bg.jpeg',
  '/classic-bg.jpeg',
  '/tba9zrout-bg.jpeg',
  '/dama-bg.jpeg',
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
  // Never cache API or socket.io traffic â€” game state must be live.
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

  // Network-first for JS/CSS so code + style updates roll out on a SINGLE
  // refresh (no more "refresh twice"). Falls back to cache when offline.
  if (/\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Stale-while-revalidate for other static assets (images, fontsâ€¦)
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
