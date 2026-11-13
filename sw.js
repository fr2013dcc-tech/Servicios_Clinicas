// Quick Ruteo — service worker: la app abre sin señal; la API nunca se guarda en caché.
const VERSION = 'qr-v11';
const BASE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

// Guarda cada archivo por separado: si alguno falta, la instalación NO se cancela.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(BASE.map(u => c.add(u).catch(err => console.warn('SW: no se pudo guardar', u, err)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && !k.startsWith('qr-tiles')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || /script\.google(usercontent)?\.com$/.test(u.hostname)) return;
  // Mosaicos del mapa: caché primero (máx. ~600), para ver el mapa con poca señal
  if (u.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open('qr-tiles').then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) { c.put(e.request, r.clone()); c.keys().then(k => { if (k.length > 600) k.slice(0, 100).forEach(x => c.delete(x)); }); }
      return r;
    }).catch(() => Response.error()));
    return;
  }
  // App: red primero (para recibir actualizaciones), caché si no hay señal
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (u.origin === location.origin || u.hostname === 'cdnjs.cloudflare.com')) caches.open(VERSION).then(c => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window'}).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
