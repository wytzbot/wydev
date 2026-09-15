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
    self.registration.showNotification(n.title||d.title||"Wyte",{body:n.body||d.body||"",icon:"/icon-192.png",data:d});
  });
}catch{}

self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{const c=list.find(x=>x.url.includes(location.origin));return c?c.focus():clients.openWindow(location.origin)}));});
// Cache the standalone offline fallback page so a navigation made while
// offline (including a cold start before the SPA's own JS has ever run)
// shows Wyte's own offline screen instead of the browser's generic error.
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
