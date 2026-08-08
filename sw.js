// Service worker: makes the app usable with no internet connection after the
// first successful load. Core app shell is precached on install. Everything
// else (including the CDN-hosted PDF/OCR libraries used only by the optional
// "Протокол" tab) is cached opportunistically the first time it's fetched
// online, then served from cache on later offline visits.
var CACHE_NAME = "coach-timer-v5";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/qr-android.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(APP_SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;

  // The HTML document itself (navigations, plus index.html directly) must be
  // network-first: with stale-while-revalidate here, every deploy would look
  // "not deployed yet" on the very next visit (old cached page serves
  // instantly, the fix only shows up on a *second* reload) — that's the
  // opposite of what a coach re-checking a bug fix expects. Static assets
  // (CSS-in-HTML doesn't apply here since it's a single file, but icons/CDN
  // libs do) stay stale-while-revalidate for instant offline loads.
  var isHtml = event.request.mode === "navigate" ||
    event.request.destination === "document" ||
    event.request.url.indexOf("index.html") !== -1;

  if(isHtml){
    event.respondWith(
      fetch(event.request).then(function(response){
        if(response && response.ok){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){
          return cached || caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached){
      var networkFetch = fetch(event.request).then(function(response){
        if(response && (response.ok || response.type === "opaque")){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        return cached; // offline and not cached: nothing we can do for this request
      });
      // stale-while-revalidate: serve cached instantly if we have it, refresh in background
      return cached || networkFetch;
    })
  );
});
