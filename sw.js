importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js","https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

// Public Firebase Web SDK configuration used only for FCM background messages.
// Do not add Firebase Admin service-account credentials here.
const FIREBASE_CONFIG={
  apiKey:"AIzaSyCqN_fapK0cvhrtQfJp6YIAefR2bfUwXeU",
  authDomain:"wydev0.firebaseapp.com",
  projectId:"wydev0",
  storageBucket:"wydev0.firebasestorage.app",
  messagingSenderId:"966164490746",
  appId:"1:966164490746:web:32e95ccb554775896ddc43",
  measurementId:"G-23WQF9RH9Y"
};

try{
  firebase.initializeApp(FIREBASE_CONFIG);
  firebase.messaging().onBackgroundMessage(p=>{
    const n=p.notification||{},d=p.data||{};
    self.registration.showNotification(n.title||d.title||"WyteLab",{body:n.body||d.body||"",icon:"/icon-192.png",data:d});
  });
}catch{}

self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{const c=list.find(x=>x.url.includes(location.origin));return c?c.focus():clients.openWindow(location.origin)}));});
// Cache the standalone offline fallback page so a navigation made while
// offline (including a cold start before the SPA's own JS has ever run)
// shows WyteLab's own offline screen instead of the browser's generic error.
// Everything else is left untouched: no app-shell caching, no interception
// of API/asset requests — only navigations, and only once the network
// request has actually failed.
const OFFLINE_CACHE="wydev-offline-v1";
// Vite fingerprints every built JS/CSS chunk with a content hash
// (/assets/name-HASH.js), so a given URL's bytes never change — it is always
// safe to serve those straight from cache without ever re-checking the
// network. This is what makes the app fast on slow/flaky connections: the
// first visit still has to download everything once, but every visit after
// that (including a reload after a network hiccup) loads instantly from
// cache instead of re-fetching the whole JS bundle. index.html itself is
// deliberately NOT cached here, so a new deploy's fresh HTML always points
// at the right (matching) hashed asset URLs — never a stale mix of the two.
const ASSET_CACHE="wydev-assets-v1";
// Icons/manifest change occasionally (not hashed), so they're served from
// cache immediately for speed but refreshed in the background on every
// request, so an update still reaches the device within a request or two.
const STATIC_CACHE="wydev-static-v1";
const STATIC_PATHS=new Set(["/favicon.ico","/favicon.svg","/favicon-16.png","/favicon-32.png","/apple-touch-icon.png","/icon-192.png","/icon-512.png","/manifest.webmanifest"]);
const CURRENT_CACHES=new Set([OFFLINE_CACHE,ASSET_CACHE,STATIC_CACHE]);

self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(OFFLINE_CACHE).then(c=>c.add("/offline.html")).catch(()=>{}));
});
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys()
    .then(names=>Promise.all(names.filter(n=>!CURRENT_CACHES.has(n)).map(n=>caches.delete(n))))
    .then(()=>self.clients.claim())
));

async function cacheFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok)cache.put(request,response.clone());
  return response;
}
async function staleWhileRevalidate(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  const network=fetch(request).then(response=>{
    if(response.ok)cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  return cached||(await network)||fetch(request);
}

self.addEventListener("fetch",e=>{
  const request=e.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==="navigate"){
    e.respondWith(fetch(request).catch(()=>caches.match("/offline.html")));
    return;
  }
  if(url.pathname.startsWith("/assets/")){
    e.respondWith(cacheFirst(request,ASSET_CACHE));
    return;
  }
  if(STATIC_PATHS.has(url.pathname)){
    e.respondWith(staleWhileRevalidate(request,STATIC_CACHE));
  }
});
