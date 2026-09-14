import { API_BASE_URL } from "./config";

export function getNotificationPermission(){
  if(typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

async function config(){
  const r=await fetch(`${API_BASE_URL}/notifications/config`,{credentials:"include"});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||"Notification service is not configured.");
  return d;
}

async function subscribeToken(token,timezone){
  const r=await fetch(`${API_BASE_URL}/notifications/subscribe`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,timezone})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||"Could not register notifications.");
  return d;
}

export async function enableNotifications(){
  if(typeof window==="undefined"||!("Notification" in window)||!("serviceWorker" in navigator)) throw new Error("This browser does not support push notifications.");
  const permission=await Notification.requestPermission();
  if(permission!=="granted") throw new Error(permission==="denied"?"Notifications are blocked by your browser.":"Notification permission was not granted.");
  const c=await config();
  if(!c.apiKey||!c.projectId||!c.messagingSenderId||!c.appId||!c.vapidKey) throw new Error("Push notifications are not fully configured yet.");
  const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/"});
  const {getApps,initializeApp}=await import("firebase/app");
  const {getMessaging,getToken}=await import("firebase/messaging");
  const app=getApps().length?getApps()[0]:initializeApp({apiKey:c.apiKey,authDomain:c.authDomain,projectId:c.projectId,storageBucket:c.storageBucket,messagingSenderId:c.messagingSenderId,appId:c.appId});
  const messaging=getMessaging(app);
  const token=await getToken(messaging,{vapidKey:c.vapidKey,serviceWorkerRegistration:reg});
  if(!token) throw new Error("Firebase did not return a push token.");
  await subscribeToken(token,Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");
  return true;
}

export async function disableNotifications(){
  const {getApps}=await import("firebase/app");
  if(!getApps().length) return;
  const {getMessaging,getToken,deleteToken}=await import("firebase/messaging");
  const messaging=getMessaging(getApps()[0]);
  const token=await getToken(messaging).catch(()=>null);
  if(token) await fetch(`${API_BASE_URL}/notifications/unsubscribe`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
  await deleteToken(messaging).catch(()=>{});
}

export async function initNotifications(){
  if(typeof Notification==="undefined"||Notification.permission!=="granted") return false;
  try{return await enableNotifications()}catch{return false}
}
