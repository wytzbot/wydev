import { API_BASE_URL } from "./config";
import { FIREBASE_CONFIG } from "./firebase-config";

export function getNotificationPermission(){
  if(typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
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
  // while WyDev is open. Background/closed delivery is handled by sw.js.
  if(!window.__wydevFcmForegroundListener){
    window.__wydevFcmForegroundListener=onMessage(messaging,payload=>{
      if(Notification.permission!=="granted") return;
      const n=payload?.notification||{},d=payload?.data||{};
      const title=String(n.title||d.title||"WyDev");
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
  return true;
}

export async function disableNotifications(){
  const {getApps}=await import("firebase/app");
  if(!getApps().length) return;
  const {getMessaging,getToken,deleteToken}=await import("firebase/messaging");
  const messaging=getMessaging(getApps()[0]);
  const token=await getToken(messaging,{vapidKey:FIREBASE_CONFIG.vapidKey}).catch(()=>null);
  if(token) await fetch(`${API_BASE_URL}/notifications/unsubscribe`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
  await deleteToken(messaging).catch(()=>{});
}

export async function initNotifications(){
  if(typeof Notification==="undefined"||Notification.permission!=="granted") return false;
  try{return await enableNotifications()}catch{return false}
}
