// Native Android bridge used by the maintained WyteLab Android shell.
// All functions remain safe in ordinary browsers/PWAs.
function bridge(){ return typeof window !== "undefined" ? window.WyBuild : null; }
export function isWyBuildApp(){ return !!bridge(); }
export function hasNativeFeature(name){ try { return !!bridge()?.hasFeature?.(String(name||"").toUpperCase()); } catch { return false; } }
export function nativeVibrate(ms=20){ const b=bridge(); if(b?.vibrate && hasNativeFeature("VIBRATION")){try{b.vibrate(ms);return true}catch{}} try{return !!navigator.vibrate?.(ms)}catch{return false} }
export async function nativeShareText(text){ const b=bridge(); if(b?.share && hasNativeFeature("SHARE")){try{return !!b.share(String(text||""))}catch{}} try{if(navigator.share){await navigator.share({text:String(text||"")});return true}}catch(e){if(e?.name!=="AbortError"){} } return false; }
export function nativeOpenExternal(url){ const b=bridge(); if(b?.openExternal){try{return !!b.openExternal(String(url||""))}catch{}} return false; }
export function nativeCopy(text){ const b=bridge(); if(b?.copy){try{return !!b.copy(String(text||""))}catch{}} return false; }
export function nativeDownload(blob,filename,mime){ const b=bridge(); if(!b?.downloadBase64 || !hasNativeFeature("DOWNLOADS")) return Promise.resolve(false); return new Promise(resolve=>{const r=new FileReader();r.onload=()=>{try{const base64=String(r.result).split(",")[1]||"";resolve(!!b.downloadBase64(String(filename||"download"),String(mime||blob.type||"application/octet-stream"),base64))}catch{resolve(false)}};r.onerror=()=>resolve(false);r.readAsDataURL(blob);}); }
export function nativePickFiles(multiple=true){ const b=bridge(); if(!b?.pickFiles)return Promise.resolve(null); return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;delete window.__WyteLabFilePickerResult;resolve(v)};window.__WyteLabFilePickerResult=(files)=>finish(Array.isArray(files)?files:null);try{b.pickFiles(!!multiple)}catch{finish(null)}setTimeout(()=>finish(null),120000);}); }
export function nativeIsOnline(){ const b=bridge(); if(b?.isOnline && hasNativeFeature("NETWORK_STATUS")){ try{return !!b.isOnline()}catch{} } try{return navigator.onLine}catch{return true} }
export function nativeDeviceInfo(){ const b=bridge(); if(!b?.getDeviceInfo || !hasNativeFeature("DEVICE_INFO")) return null; try{return JSON.parse(b.getDeviceInfo())}catch{return null} }
export function nativeBatteryPercent(){ const b=bridge(); if(!b?.batteryPercent || !hasNativeFeature("BATTERY")) return null; try{const p=Number(b.batteryPercent());return p>=0?p:null}catch{return null} }
export function nativeNotify(title,body){ const b=bridge(); if(!b?.showLocalNotification || !hasNativeFeature("LOCAL_NOTIFICATIONS")) return false; try{b.showLocalNotification(String(title||"WyteLab"),String(body||""));return true}catch{return false} }
// The native shell dispatches these as window CustomEvents (see MainActivity's
// handleIntent/onNewIntent) and, to survive a listener attaching after the
// event already fired on cold start, also stashes the same payload on
// window.__WyteLabDeepLink / window.__WyteLabShared. Subscribers should call
// the matching consume* function once on mount, then the on* function for
// anything that arrives afterward.
export function consumePendingDeepLink(){ try{const v=window.__WyteLabDeepLink;delete window.__WyteLabDeepLink;return v||null}catch{return null} }
export function onNativeDeepLink(handler){ if(typeof window==="undefined")return()=>{}; const fn=(e)=>handler(e?.detail);window.addEventListener("wytelab:deep-link",fn);return()=>window.removeEventListener("wytelab:deep-link",fn); }
export function consumePendingShare(){ try{const v=window.__WyteLabShared;delete window.__WyteLabShared;return v||null}catch{return null} }
export function onNativeShare(handler){ if(typeof window==="undefined")return()=>{}; const fn=(e)=>handler(e?.detail);window.addEventListener("wytelab:shared",fn);return()=>window.removeEventListener("wytelab:shared",fn); }
