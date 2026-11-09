// Service worker mínimo: guarda la app en el dispositivo para que abra aunque
// no haya señal en el evento. No toca las llamadas a Supabase (otro dominio):
// las ventas sin internet las maneja la cola de la app.

const CACHE = 'teravino-pos-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const put = (req, res) => {
  if (res && res.ok) {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Tipografías de Google: primero caché.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))))
    return
  }
  if (url.origin !== self.location.origin) return

  // Páginas: primero red (para recibir versiones nuevas), si no hay, la copia.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => put('/index.html', res))
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Archivos con hash (/assets/…): no cambian, primero caché.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))))
    return
  }

  // Lo demás: copia inmediata y se actualiza en segundo plano.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => put(req, res))
        .catch(() => hit)
      return hit || net
    }),
  )
})
