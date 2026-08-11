// BlackPyre service worker — offline app shell, network-first for food APIs
// NOTE: sw.js deliberately does NOT appear in SHELL. The browser fetches the service
// worker itself through its own update mechanism (byte-compare on navigation); precaching
// it would freeze updates and break the cache-bump release ritual. Do not "fix" this.
const CACHE = "blackpyre-v112-water-card-1";
const SHELL = [
  "./",
  "./index.html",
  "./data-quotes.js",
  "./data-foods.js",
  "./data-suggestions.js",
  "./data-faq.js",
  "./data-exercises.js",
  "./data-exercise-card-profiles.js",
  "./scripts/01-storage.js?v=web-v112-water-card-1",
  "./scripts/02-food.js",
  "./scripts/03-card-profiles.js",
  "./scripts/03-train.js?v=web-v112-water-card-1",
  "./scripts/04-weight.js",
  "./scripts/05-ai.js?v=web-v112-water-card-1",
  "./scripts/06-settings.js?v=web-v112-water-card-1",
  "./scripts/07-boot.js?v=web-v112-water-card-1",
  "./vendor/html5-qrcode.min.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./privacy.html",
  "./privacy-ios.html",
  "./support.html",
  "./third-party-notices.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  if (e.request.method !== "GET") return;

  // Food database calls: network only (always fresh, never cached)
  if (url.includes("openfoodfacts.org")) {
    return; // let it hit the network normally
  }

  // Fonts + app shell: cache-first with network fallback + backfill
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          // cache successful same-origin and font responses
          if (
            res &&
            (res.status === 200 || res.type === "opaque") &&
            (url.startsWith(self.location.origin) ||
              url.includes("fonts.googleapis.com") ||
              url.includes("fonts.gstatic.com"))
          ) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
