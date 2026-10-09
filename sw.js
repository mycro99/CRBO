const CACHE_NAME = "crbo-pwa-shell-v1";
const BASE_URL = self.registration.scope;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./pwa-install.css",
  "./pwa-install.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
].map((path) => new URL(path, BASE_URL).href);
const CORE_PATHS = new Set(CORE_ASSETS.map((asset) => new URL(asset).pathname));

self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'CRBO — Demande de matériel',{body:data.body||'Une nouvelle demande de matériel est disponible.',icon:new URL('./icons/icon-192.png',BASE_URL).href,badge:new URL('./icons/icon-192.png',BASE_URL).href,tag:data.tag||'crbo-material-request',data:{url:new URL('./inventaire/inventaire.html?demandes=1',BASE_URL).href}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=new URL('./inventaire/inventaire.html?demandes=1',BASE_URL).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const client of clients){if(client.url.startsWith(new URL('./inventaire/inventaire.html',BASE_URL).href)){await client.navigate(url);return client.focus();}}return self.clients.openWindow(url);}));
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(new URL("./index.html", BASE_URL).href)));
    return;
  }

  if (!CORE_PATHS.has(url.pathname)) return;
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
});
