self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Explicit network-first passthrough. The service worker exists only to
// support browser-native PWA installability. Registering an explicit
// respondWith call silences the "no-op fetch handler" DevTools warning and
// avoids the extra navigation overhead Chrome flags on empty fetch listeners.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
