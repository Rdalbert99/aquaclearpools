// super simple cache-first SW
const CACHE = "acp-v1"; // bump this to force refresh on deploy

const PRECACHE = [
  "/", 
  "/manifest.json",
  // add your logo, CSS, and any static pages if you want them guaranteed offline:
  // "/icons/icon-192.png",
  // "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});