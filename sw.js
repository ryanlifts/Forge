// BlackPyre service worker — offline app shell, network-first for food APIs
// NOTE: sw.js deliberately does NOT appear in SHELL. The browser fetches the service
// worker itself through its own update mechanism (byte-compare on navigation); precaching
// it would freeze updates and break the cache-bump release ritual. Do not "fix" this.
const CACHE = "blackpyre-v121-food-catalog-1";
const FOOD_CATALOG_CACHE = "blackpyre-food-catalog-v1";
const SHELL = [
  "./?app=web-v121-food-catalog-1",
  "./index.html",
  "./data-quotes.js?v=web-v121-food-catalog-1",
  "./data-foods.js?v=web-v121-food-catalog-1",
  "./data-suggestions.js?v=web-v121-food-catalog-1",
  "./data-food-catalog.js?v=web-v121-food-catalog-1",
  "./data-faq.js?v=web-v121-food-catalog-1",
  "./data-exercises.js?v=web-v121-food-catalog-1",
  "./data-exercise-card-profiles.js?v=web-v121-food-catalog-1",
  "./scripts/01-storage.js?v=web-v121-food-catalog-1",
  "./scripts/02-food.js?v=web-v121-food-catalog-1",
  "./scripts/03-card-profiles.js?v=web-v121-food-catalog-1",
  "./scripts/03-train.js?v=web-v121-food-catalog-1",
  "./scripts/04-weight.js?v=web-v121-food-catalog-1",
  "./scripts/05-ai.js?v=web-v121-food-catalog-1",
  "./scripts/06-settings.js?v=web-v121-food-catalog-1",
  "./scripts/07-boot.js?v=web-v121-food-catalog-1",
  "./vendor/html5-qrcode.min.js?v=web-v121-food-catalog-1",
  "./manifest.json?v=web-v121-food-catalog-1",
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
      Promise.all(keys.filter((k) => k !== CACHE && k !== FOOD_CATALOG_CACHE).map((k) => caches.delete(k)))
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

  // The browser catalog mirror is refreshed online and cached for later
  // offline reuse. Every shard is also checked against the signed manifest's
  // byte count and SHA-256 before BlackPyre uses it.
  if (url.startsWith("https://ryanlifts.github.io/BlackPyre-Food-Catalog/")) {
    e.respondWith(
      caches.open(FOOD_CATALOG_CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        try {
          const fresh = await fetch(e.request);
          if (fresh && fresh.ok) await cache.put(e.request, fresh.clone());
          return fresh;
        } catch (error) {
          if (cached) return cached;
          throw error;
        }
      })
    );
    return;
  }

  // Navigations are network-first while online so an installed PWA cannot remain pinned
  // to an old cached index.html. Offline, fall back to the requested cached page and then
  // the current cached app shell.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request,{cache:"no-store"})
        .catch(() =>
          caches.match(e.request).then((cached) =>
            cached || caches.match("./index.html")
          )
        )
    );
    return;
  }

  // Static assets: cache-first with network fallback + backfill.
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
        .catch((error) => {
          if (e.request.mode === "navigate") return caches.match("./index.html");
          throw error;
        });
    })
  );
});
