importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js","https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");
let firebaseReady=false;
(async()=>{try{const r=await fetch("/api/notifications/config",{credentials:"include",cache:"no-store"});const c=await r.json();if(c.apiKey){firebase.initializeApp({apiKey:c.apiKey,authDomain:c.authDomain,projectId:c.projectId,storageBucket:c.storageBucket,messagingSenderId:c.messagingSenderId,appId:c.appId});firebaseReady=true;firebase.messaging().onBackgroundMessage(p=>{const n=p.notification||{},d=p.data||{};self.registration.showNotification(n.title||d.title||"WyDev",{body:n.body||d.body||"",icon:"/icon-192.png",data:d});});}}catch{}})();
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{const c=list.find(x=>x.url.includes(location.origin));return c?c.focus():clients.openWindow(location.origin)}));});
// Cache the standalone offline fallback page so a navigation made while
// offline (including a cold start before the SPA's own JS has ever run)
// shows WyDev's own offline screen instead of the browser's generic error.
// Everything else is left untouched: no app-shell caching, no interception
// of API/asset requests — only navigations, and only once the network
// request has actually failed.
const OFFLINE_CACHE="wydev-offline-v1";
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(OFFLINE_CACHE).then(c=>c.add("/offline.html")).catch(()=>{}));
});
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  if(e.request.mode!=="navigate")return;
  e.respondWith(fetch(e.request).catch(()=>caches.match("/offline.html")));
});
