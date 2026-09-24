// Offline support for the app shell only. Challenge data lives in localStorage and is never cached here.
const scope = self.registration.scope
// Sibling GitHub Pages projects share this origin's Cache Storage, so the cache name includes the scope.
const CACHE = `battle-h2o-v1 ${scope}`
const shellPath = new URL(scope).pathname
// Shell files are same-origin, so server Vary headers (Origin, Accept-Encoding) must not block offline matches.
const MATCH = { ignoreVary: true }
// Vite content-hashes everything in assets/, so a cached copy there can never be stale.
const hashed = (url) => new URL(url).pathname.startsWith(`${shellPath}assets/`)

async function cacheShell(response) {
  const cache = await caches.open(CACHE)
  const html = await response.clone().text()
  const assets = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map(([, url]) => new URL(url, scope).href)
      .filter((url) => url.startsWith(scope) && url !== scope),
  )
  // Unhashed files (icons, manifest) are revalidated; the HTML is only replaced once every file it needs is cached.
  await Promise.all(
    [...assets].map(async (url) => {
      if (hashed(url) && (await cache.match(url, MATCH))) return
      await cache.add(new Request(url, { cache: 'no-cache' }))
    }),
  )
  await cache.put(scope, response)
  for (const request of await cache.keys()) {
    if (request.url !== scope && !assets.has(request.url)) await cache.delete(request)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(scope, { cache: 'no-cache' }).then((response) => {
      if (!response.ok) throw new Error(`App shell unavailable (${response.status})`)
      return cacheShell(response)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const stale = (await caches.keys()).filter((key) => key.startsWith('battle-h2o-') && key.endsWith(` ${scope}`) && key !== CACHE)
      await Promise.all(stale.map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const { pathname } = new URL(request.url)
          if (response.ok && (pathname === shellPath || pathname === `${shellPath}index.html`)) {
            event.waitUntil(cacheShell(response.clone()).catch(() => {}))
          }
          return response
        } catch {
          return (await (await caches.open(CACHE)).match(scope, MATCH)) || Response.error()
        }
      })(),
    )
    return
  }
  event.respondWith((async () => (await (await caches.open(CACHE)).match(request, MATCH)) || fetch(request))())
})
