const BASE = new URL("./", self.location).pathname;
const BUILD = "mw8aik5z";
const PRECACHE = ["/plainview/assets/atkinson-hyperlegible-latin-400-normal-BbWidj28.woff","/plainview/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2","/plainview/assets/atkinson-hyperlegible-latin-700-normal-BK6Glc0m.woff","/plainview/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2","/plainview/assets/atkinson-hyperlegible-latin-ext-400-normal-Bbz-b3yf.woff","/plainview/assets/atkinson-hyperlegible-latin-ext-400-normal-DRk46D-x.woff2","/plainview/assets/atkinson-hyperlegible-latin-ext-700-normal-BoVPHkS0.woff2","/plainview/assets/atkinson-hyperlegible-latin-ext-700-normal-CKkU2Dpt.woff","/plainview/assets/fraunces-latin-600-normal-BFCDtZfi.woff2","/plainview/assets/fraunces-latin-600-normal-DL5QCzvS.woff","/plainview/assets/fraunces-latin-700-normal-CEOla-zY.woff2","/plainview/assets/fraunces-latin-700-normal-DTjk5d1Q.woff","/plainview/assets/fraunces-latin-ext-600-normal-B0Dy4lqi.woff","/plainview/assets/fraunces-latin-ext-600-normal-BtzmzP0X.woff2","/plainview/assets/fraunces-latin-ext-700-normal-CanUGppC.woff2","/plainview/assets/fraunces-latin-ext-700-normal-DuBstVeD.woff","/plainview/assets/fraunces-vietnamese-600-normal-BjlAJixd.woff2","/plainview/assets/fraunces-vietnamese-600-normal-DlAl5EAR.woff","/plainview/assets/fraunces-vietnamese-700-normal-DH94m5DZ.woff2","/plainview/assets/fraunces-vietnamese-700-normal-DxawQjq2.woff","/plainview/assets/index-BIb_a6e9.css","/plainview/assets/index-stwPZpOu.js","/plainview/assets/index.esm-DH4nVt1n.js","/plainview/assets/pdf.worker.min-CIqJB0yW.mjs","/plainview/firebase-config.js","/plainview/flyers/school.svg","/plainview/flyers/sermon-notes.pdf","/plainview/flyers/sunday.svg","/plainview/flyers/supper.svg","/plainview/flyers/wednesday.svg","/plainview/flyers/youth-night.svg","/plainview/icons/apple-touch-icon.png","/plainview/icons/favicon-32.png","/plainview/icons/icon-192.png","/plainview/icons/icon-512.png","/plainview/icons/icon-maskable-192.png","/plainview/icons/icon-maskable-512.png","/plainview/index.html","/plainview/logo.png","/plainview/manifest.webmanifest","/plainview/videos/christmas.jpg","/plainview/videos/dedication.jpg","/plainview/videos/vbs.jpg","/plainview/videos/youth.jpg"];
const SHELL = `plainview-shell-${BUILD}`;
const IMAGES = `plainview-images-${BUILD}`;
const IMAGE_CAP = 80;

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

function isVideo(url) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.pathname);
}

function isImage(url, request) {
  if (request.destination === "image") return true;
  return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url.pathname);
}

function isHashedAsset(url) {
  return url.pathname.includes(`${BASE}assets/`);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== IMAGES && key.startsWith("plainview-")).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

async function trimImages(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CAP) return;
  await Promise.all(keys.slice(0, keys.length - IMAGE_CAP).map((key) => cache.delete(key)));
}

async function fromNetwork(request) {
  const response = await fetch(request);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;
  if (isVideo(url) || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          const cache = await caches.open(SHELL);
          await cache.put(new URL("index.html", self.location).href, copy);
        }
        return response;
      } catch {
        const cached = (await caches.match(new URL("index.html", self.location).href)) || (await caches.match(BASE));
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fromNetwork(request);
      if (response.ok) {
        const cache = await caches.open(SHELL);
        await cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  if (isImage(url, request)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const cached = await cache.match(request);
      const refresh = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await cache.put(request, response.clone());
            await trimImages(cache);
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(SHELL);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
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
