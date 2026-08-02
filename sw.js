// Service worker: makes the app usable with no internet connection after the
// first successful load. Core app shell is precached on install. Everything
// else (including the CDN-hosted PDF/OCR libraries used only by the optional
// "Протокол" tab) is cached opportunistically the first time it's fetched
// online, then served from cache on later offline visits.
var CACHE_NAME = "coach-timer-v1";
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
