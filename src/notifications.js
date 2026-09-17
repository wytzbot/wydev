import { API_BASE_URL } from "./config";
import { FIREBASE_CONFIG } from "./firebase-config";
import { loadState, saveState } from "./storage";
import { fetchTimeout } from "./net";

// Browser Notification permission is a one-way ratchet: once the user grants
// it, JS can never programmatically revoke it (only the user can, via their
// browser's site settings). That means `Notification.permission` alone can't
// tell us whether *WyteLab* currently has an active subscription — it only
// tells us whether the browser would *allow* one. We track the user's actual
// choice (did they press Enable or Disable in Settings) separately, here.
const ENABLED_KEY = "notificationsEnabled";

// --- Shared backend calls -------------------------------------------------
// Both the web-push path below and the Median native path further down end
// up with a plain FCM registration token and hand it to the same two
// endpoints — the server already stores raw FCM tokens (`wydev_fcm_tokens`)
// and sends through the Firebase Admin SDK, so a token minted by Median's
// native SDK is indistinguishable from one minted by the browser and needs
// no backend changes at all.
async function subscribeToken(token,timezone){
  const r=await fetchTimeout(`${API_BASE_URL}/notifications/subscribe`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,timezone})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||"Could not register notifications.");
  return d;
}
async function unsubscribeToken(token){
  if(!token) return;
  await fetchTimeout(`${API_BASE_URL}/notifications/unsubscribe`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).catch(()=>{});
}

// --- Median.co native FCM bridge -----------------------------------------
// When this build is wrapped by median.co with the "Firebase Cloud
// Messaging" native plugin enabled, push notifications go through Median's
// own native FCM SDK integration on Android/iOS instead of the browser Push
// API — which a bare Android WebView doesn't implement at all (this is why
// the web branch below always reports "unsupported" in the APK). Median
// injects a `median` object into every page at runtime; `navigator.userAgent`
// also carries a `median`/`gonative` marker so we can detect the wrapped app
// without waiting on the bridge to finish loading.
const MEDIAN_TOKEN_KEY = "medianFcmToken";
const MEDIAN_PERMISSION_KEY = "medianFcmPermission"; // cached "granted" | "denied" | "default"

export function isMedianApp(){
  return typeof navigator!=="undefined" && /median|gonative/i.test(navigator.userAgent||"");
}

// The bridge library is injected asynchronously; `median_library_ready()` is
// Median's own hook for "the library just became available". If it's
// already there (e.g. this runs after first paint) we resolve immediately;
// otherwise we chain onto any `median_library_ready` the page already
// defined so we don't clobber it.
function waitForMedianBridge(timeoutMs=8000){
  return new Promise((resolve,reject)=>{
    if(typeof window==="undefined"){ reject(new Error("Median bridge unavailable")); return; }
    if(window.median){ resolve(window.median); return; }
    let settled=false;
    const prevReady=window.median_library_ready;
    const timer=setTimeout(()=>{
      if(settled) return;
      settled=true;
      window.median_library_ready=prevReady;
      reject(new Error("Median bridge did not initialize in time."));
    },timeoutMs);
    window.median_library_ready=function(){
      try{ prevReady?.(); }catch{}
      if(settled) return;
      settled=true;
      clearTimeout(timer);
      resolve(window.median);
    };
  });
}

// The Median docs show every firebaseMessaging method taking a `callback`
// option; the bridge overview also notes some commands return promises
// instead. Support both calling conventions so this keeps working whichever
// one a given Median SDK build actually implements.
function callBridge(fn,args={}){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const done=(result)=>{ if(settled) return; settled=true; resolve(result); };
    try{
      const ret=fn({...args,callback:done});
      if(ret&&typeof ret.then==="function") ret.then(done).catch((e)=>{ if(!settled){settled=true;reject(e);} });
    }catch(e){ reject(e); }
  });
}

function fcmBridge(median){
  if(!median?.firebaseMessaging) throw new Error("This app build does not have the Median Firebase Cloud Messaging plugin enabled.");
  return median.firebaseMessaging;
}

async function medianCheckPermission(){
  try{
    const median=await waitForMedianBridge(3000);
    const fcm=fcmBridge(median);
    const result=await callBridge(fcm.checkPermission);
    const value=result?.granted?"granted":"denied";
    saveState(MEDIAN_PERMISSION_KEY,value);
    return value;
  }catch{
    return loadState(MEDIAN_PERMISSION_KEY,"default");
  }
}

async function medianGetToken(fcm){
  // register() mints a token if none exists yet; getToken() just reads the
  // current one. Try register() first so this works on a first-ever call.
  let result=await callBridge(fcm.register);
  if(!result?.token) result=await callBridge(fcm.getToken);
  if(!result?.token) throw new Error("Median did not return an FCM token. Confirm google-services.json/GoogleService-Info.plist are uploaded and the Firebase Cloud Messaging plugin is enabled in App Studio.");
  return result.token;
}

let medianListenersAttached=false;
function attachMedianListeners(fcm){
  if(medianListenersAttached) return;
  medianListenersAttached=true;
  // Foreground banners are controlled by the plugin's own "Show Foreground
  // Notifications" App Studio setting; nothing to do here for that. Deep
  // links from a tapped notification's targetUrl are handled natively by
  // Median's own Deep Linking config. This listener exists so a tap that
  // *doesn't* carry a targetUrl (or arrives while the app is already open)
  // still has somewhere in WyteLab's own code to react, if that's ever
  // needed — currently a no-op.
  fcm.notificationClicked?.addListener?.(()=>{});
}

async function enableMedianNotifications(){
  const median=await waitForMedianBridge();
  const fcm=fcmBridge(median);
  const permissionResult=await callBridge(fcm.requestPermission);
  saveState(MEDIAN_PERMISSION_KEY,permissionResult?.granted?"granted":"denied");
  if(!permissionResult?.granted) throw new Error("Notification permission was not granted.");
  const token=await medianGetToken(fcm);
  saveState(MEDIAN_TOKEN_KEY,token);
  attachMedianListeners(fcm);
  await subscribeToken(token,Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");
  saveState(ENABLED_KEY,true);
  return true;
}

async function disableMedianNotifications(){
  const token=loadState(MEDIAN_TOKEN_KEY,"");
  try{
    const median=await waitForMedianBridge(3000);
    await callBridge(fcmBridge(median).deleteToken);
  }catch{}
  await unsubscribeToken(token);
  saveState(MEDIAN_TOKEN_KEY,"");
  saveState(ENABLED_KEY,false);
}

// --- Public API ------------------------------------------------------------

export function getNotificationPermission(){
  if(isMedianApp()) return loadState(MEDIAN_PERMISSION_KEY,"default");
  if(typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

// Best-effort async refresh of the cached Median permission value — call
// this from a component's mount effect if you want the UI to reflect the
// real OS-level permission instead of the last value we happened to cache.
// No-op (and returns the same sync value) outside a Median app.
export async function refreshNotificationPermission(){
  if(isMedianApp()) await medianCheckPermission();
  return getNotificationPermission();
}

// True only when permission is granted AND the user has explicitly enabled
// notifications in WyteLab (and hasn't since disabled them).
export function isNotificationsEnabled(){
  return getNotificationPermission()==="granted" && !!loadState(ENABLED_KEY,false);
}

export async function enableNotifications(){
  if(isMedianApp()) return enableMedianNotifications();

  if(typeof window==="undefined"||!("Notification" in window)||!("serviceWorker" in navigator)) throw new Error("This browser does not support push notifications.");
  const permission=await Notification.requestPermission();
  if(permission!=="granted") throw new Error(permission==="denied"?"Notifications are blocked by your browser.":"Notification permission was not granted.");
  const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/"});
  const {getApps,initializeApp}=await import("firebase/app");
  const {getMessaging,getToken,onMessage}=await import("firebase/messaging");
  const app=getApps().length?getApps()[0]:initializeApp(FIREBASE_CONFIG);
  const messaging=getMessaging(app);
  // Use the project VAPID public key for reliable Web Push registration.
  // The key is public and belongs in the browser bundle.
  const token=await getToken(messaging,{serviceWorkerRegistration:reg,vapidKey:FIREBASE_CONFIG.vapidKey});
  if(!token) throw new Error("Firebase did not return a push token.");

  // FCM notification payloads are delivered to the page through onMessage
  // while WyteLab is open. Background/closed delivery is handled by sw.js.
  if(!window.__wydevFcmForegroundListener){
    window.__wydevFcmForegroundListener=onMessage(messaging,payload=>{
      if(Notification.permission!=="granted") return;
      const n=payload?.notification||{},d=payload?.data||{};
      const title=String(n.title||d.title||"WyteLab");
      const body=String(n.body||d.body||"");
      try{
        const note=new Notification(title,{body,icon:"/icon-192.png",tag:String(d.type||"wydev-notification")});
        note.onclick=()=>{
          try{window.focus();}catch{}
          note.close();
        };
      }catch{}
    });
  }
  await subscribeToken(token,Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");
  saveState(ENABLED_KEY,true);
  return true;
}

export async function disableNotifications(){
  if(isMedianApp()) return disableMedianNotifications();

  try{
    const {getApps}=await import("firebase/app");
    if(getApps().length){
      const {getMessaging,getToken,deleteToken}=await import("firebase/messaging");
      const messaging=getMessaging(getApps()[0]);
      const token=await getToken(messaging,{vapidKey:FIREBASE_CONFIG.vapidKey}).catch(()=>null);
      await unsubscribeToken(token);
      await deleteToken(messaging).catch(()=>{});
    }
  } finally {
    // Always record the user's intent locally, even if the network call to
    // unsubscribe failed or there was nothing to unregister — otherwise the
    // Disable button silently does nothing and Enable reappears as if it
    // never ran.
    saveState(ENABLED_KEY,false);
  }
}

export async function initNotifications(){
  if(isMedianApp()){
    // Only re-subscribe automatically if the user had actually turned
    // notifications on before, same rule as the web path below.
    if(!loadState(ENABLED_KEY,false)) return false;
    try{
      const permission=await medianCheckPermission();
      if(permission!=="granted") return false;
      const median=await waitForMedianBridge();
      const fcm=fcmBridge(median);
      attachMedianListeners(fcm);
      const token=await medianGetToken(fcm);
      saveState(MEDIAN_TOKEN_KEY,token);
      await subscribeToken(token,Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");
      return true;
    }catch{ return false; }
  }

  if(typeof Notification==="undefined"||Notification.permission!=="granted") return false;
  // Only re-subscribe automatically if the user had actually turned
  // notifications on before. Otherwise a user who pressed "Disable" would
  // get silently re-subscribed on their next visit, since browser permission
  // stays "granted" forever once given.
  if(!loadState(ENABLED_KEY,false)) return false;
  try{return await enableNotifications()}catch{return false}
}
