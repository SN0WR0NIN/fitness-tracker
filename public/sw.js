const CACHE_NAME = 'kg-stay-active-v3';
const CACHE_PREFIX = 'kg-stay-active-';
const OFFLINE_URL = '/offline';
const STATIC_ASSETS = [OFFLINE_URL, '/kg-gorilla-192.png', '/kg-gorilla-512.png', '/kg-gorilla-maskable-512.png', '/kg-gorilla-apple.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  // New versions wait until the user explicitly confirms an update.
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  // No navigation response, private page, proof image or RSC payload is cached.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response('You are offline. Reconnect to use KG Active.', {status:503,headers:{'Content-Type':'text/plain'}})));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request,copy)));
      }
      return response;
    })));
  }
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target='/notifications';
  try {const url=new URL(event.notification.data?.url || target,self.location.origin);if(url.origin===self.location.origin)target=url.pathname+url.search+url.hash;}catch{}
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then((clients) => {
    const existing=clients.find((client) => 'focus' in client);
    return existing?existing.focus().then(() => existing.navigate(target)):self.clients.openWindow(target);
  }));
});
