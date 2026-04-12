/**
 * POS SaaS Service Worker
 *
 * Strategy:
 *  - Static assets (JS/CSS/fonts) : Cache-first, update in background
 *  - HTML navigation              : Network-first, fall back to /index.html
 *  - GET /api/*                   : Network-first, fall back to cache (read-only offline)
 *  - POST/PUT/DELETE /api/*       : Network-only (app handles offline queueing)
 */

const STATIC_CACHE  = 'pos-static-v1';
const API_CACHE     = 'pos-api-v1';
const CACHE_VERSION = 1;

// Files to precache on install (add more as needed)
const PRECACHE_URLS = ['/', '/index.html'];

// ── Install ────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old cache versions ─────────────────────
self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin + HTTPS (or localhost)
  if (url.origin !== self.location.origin) return;

  // ── API calls ──────────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return; // non-GET: let it fail naturally (app queues it)

    event.respondWith(networkFirstAPI(request));
    return;
  }

  // ── Static assets (.js, .css, images, fonts) ──────────────
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // ── Navigation (SPA routes) ───────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }
});

// ── Strategy: network-first for API GET ───────────────────────
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone()); // update cache in background
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return a JSON error so the app can show an "offline" state
    return new Response(
      JSON.stringify({ error: 'offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── Strategy: cache-first for static assets ───────────────────
async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

// ── Strategy: network-first for navigation, fall back to shell ─
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request) ||
                   await caches.match('/index.html') ||
                   await caches.match('/');
    return cached || new Response('<h1>POS System — Offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|svg|ico|webp)$/i.test(pathname);
}

// ── Message handler: allow app to trigger cache clears ─────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE);
  }
});
