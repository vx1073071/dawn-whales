/**
 * PWA Service Worker — Offline cache + stale-while-revalidate
 * (ML-45-01, R45 Phase 6.2)
 *
 * Caching strategy:
 * - HTML: Network-first (always get latest)
 * - JS/CSS: Stale-while-revalidate (use cache, update in background)
 * - Images/Fonts: Cache-first (immutable assets)
 * - API responses: Network-only (don't cache financial data)
 */

const CACHE_VERSION = 'dw-v0.11.0';
const CACHE_NAMES = {
  static: `${CACHE_VERSION}-static`,
  images: `${CACHE_VERSION}-images`,
  fonts: `${CACHE_VERSION}-fonts`,
};

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json',
];

// ── Install: pre-cache core assets ──────────────────────────────────────

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.static).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Force waiting SW to become active
      return (self as any).skipWaiting();
    })
  );
});

// ── Activate: clean old caches ─────────────────────────────────────────

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key.startsWith('dw-') && !Object.values(CACHE_NAMES).includes(key))
          .map(key => caches.delete(key))
      );
    }).then(() => {
      return (self as any).clients.claim();
    })
  );
});

// ── Fetch: route by content type ───────────────────────────────────────

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // API calls: network-only (financial data must be fresh)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/ws/')) {
    return; // Let browser handle normally
  }

  // Images: cache-first
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.images));
    return;
  }

  // Fonts: cache-first
  if (
    request.destination === 'font' ||
    url.pathname.match(/\.(woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.fonts));
    return;
  }

  // JS/CSS: stale-while-revalidate
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.match(/\.(js|css)$/)
  ) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.static));
    return;
  }

  // HTML/Documents: network-first
  if (
    request.destination === 'document' ||
    request.mode === 'navigate'
  ) {
    event.respondWith(networkFirst(request, CACHE_NAMES.static));
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.static));
});

// ── Caching strategies ─────────────────────────────────────────────────

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback for images
    if (request.destination === 'image') {
      return new Response('', { status: 503, statusText: 'Offline' });
    }
    throw new Error('Network unavailable');
  }
}

async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  // Return cached immediately, update in background
  return cached ?? fetchPromise;
}

async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline fallback page
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DAWN WHALES — Offline</title>
       <style>body{background:#0d1117;color:#9ca3af;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
       .box{text-align:center}.box h1{color:#c9a96e;font-size:1.5rem}.box p{font-size:.9rem;opacity:.6}
       button{margin-top:1rem;padding:.5rem 1.5rem;background:#c9a96e;color:#000;border:none;border-radius:.5rem;font-weight:bold;cursor:pointer}
       </style></head><body><div class="box"><h1>🐋 DAWN WHALES</h1>
       <p>当前离线 — 请检查网络连接</p><button onclick="location.reload()">重试</button></div></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Register the service worker
export {};
