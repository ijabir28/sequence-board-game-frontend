// The service worker: what lets the installed app open instantly and play offline (hot-seat games and the training
// run entirely in the page). Plain JS, because vite.config.ts copies it into the build as /sw.js unbundled, filling in
// the two placeholders below: the build's files and a version that changes whenever any of them does.
//
// - The app shell (index.html, the hashed /assets/ files, icons) is cached when the worker installs, so every file of
//   one build is there together. A new build's worker waits until the page says "reload" (see serviceWorker.ts), so a
//   running page never loads a lazy chunk from a different build.
// - Pages are fetched from the network first and fall back to the cached shell offline; the app's router takes it
//   from there.
// - Card faces (/decks/, the backend's /images/) and Google Fonts are cached the first time they're used.
// - The backend's API, auth and socket are never touched: they must be live, and they carry the session cookie.

/* global self, caches, URL, Response, fetch */

const VERSION = '__SW_VERSION__';
const PRECACHE = /** @type {string[]} */ (__SW_PRECACHE__);

const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = 'runtime-v1';
const LIVE_PREFIXES = ['/api/', '/user/', '/room/', '/game/', '/board/', '/matchmaking/', '/friends/', '/socket.io/', '/health'];
const RUNTIME_PREFIXES = ['/decks/', '/images/', '/icons/'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (LIVE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;
    if (request.mode === 'navigate') {
      event.respondWith(pageFromNetwork(request));
    } else if (PRECACHE.includes(url.pathname)) {
      event.respondWith(caches.match(url.pathname, { cacheName: SHELL_CACHE }).then((hit) => hit ?? fetch(request)));
    } else if (RUNTIME_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      event.respondWith(cacheFirst(request));
    }
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/** The page from the server, or the cached app shell when there's no connection. */
async function pageFromNetwork(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const shell = await caches.match('/index.html', { cacheName: SHELL_CACHE });
    if (shell) return shell;
    throw error;
  }
}

/** For files that never change at a URL (card faces): the cached copy, else fetch and keep it. */
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** For files that may change (the fonts' CSS): answer from the cache at once, refresh it in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      // Font files are cross-origin; an opaque response (status 0) is still a usable font.
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit ?? Response.error());
  return hit ?? refresh;
}
