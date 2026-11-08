const BASE = new URL("./", self.location).pathname;
const CACHE = "plainview-baptist-v2";

try {
  importScripts(new URL("firebase-config.js", self.location).href);
} catch {
  // The app still opens when the config file cannot be fetched.
}

function appPath(href) {
  if (!href) return BASE;
  if (/^(https?:|data:|blob:)/i.test(href)) return href;
  if (href.startsWith(BASE)) return href;
  if (href.startsWith("/")) return BASE + href.slice(1);
  return BASE + href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([BASE, appPath("logo.png"), appPath("manifest.webmanifest"), appPath("firebase-config.js")]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(BASE, copy));
          }
          return response;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = appPath(event.notification.data?.href || BASE);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(href);
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
