export const ext=p=>p.split(".").pop()?.toLowerCase()||"";
export const languageFor=p=>({js:"javascript",jsx:"javascript",ts:"javascript",tsx:"javascript",json:"json",md:"markdown",py:"python",css:"css",html:"html"}[ext(p)]||"text");

// Older/lower-end Android WebViews (and any WebView build without the
// modern async Clipboard API enabled) don't expose `navigator.clipboard` at
// all — `navigator.clipboard?.writeText` then silently resolves to
// `undefined` and nothing gets copied, no error either. This falls back to
// the old `execCommand("copy")` trick (works in effectively every WebView
// going back to Android 4.4) so "Copy" buttons still do something there.
function legacyCopy(text){
  try{
    const ta=document.createElement("textarea");
    ta.value=text;
    ta.style.position="fixed";
    ta.style.opacity="0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok=document.execCommand("copy");
    ta.remove();
    return ok;
  }catch{return false}
}

export const copy=async text=>{
  try { const b=window.WyBuild; if(b?.copy) return !!b.copy(String(text)); } catch {}
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return true}catch{}
  }
  return legacyCopy(text);
};

// Copies text via the Clipboard + Blob APIs (as opposed to plain writeText)
// so larger, richly-formatted diagnosis reports copy reliably as a discrete
// text/plain payload. Falls back to writeText, then to the legacy
// execCommand path, for browsers/WebViews without ClipboardItem support.
export const copyBlob=async text=>{
  const blob=new Blob([text],{type:"text/plain"});
  if(navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){
    try{await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);return true}catch{}
  }
  return copy(text);
};

// Opens a URL as a genuine new top-level context when possible, but the
// Android APK shell is a bare WebView: `window.open`/`target="_blank"`
// create a *new* browsing context, which needs the native host to implement
// `onCreateWindow` (multi-window support) to do anything at all — and this
// shell doesn't (its own build notes only describe intercepting ordinary
// same-window navigations and routing "genuinely external destinations" to
// the device browser). Without that, `window.open` just returns null and
// the tap does nothing. So: try `window.open` first (this is exactly what
// you want on desktop/regular mobile browsers, where it works fine and
// preserves the user's place in the app); if it's blocked or returns
// nothing, fall back to a same-window navigation, which is the code path
// the shell's external-link handling actually intercepts.
export function openExternal(url) {
  if (!url) return;
  try { if (window.WyBuild?.openExternal && window.WyBuild.openExternal(url)) return; } catch {}
  let w = null;
  try {
    w = window.open(url, "_blank", "noopener,noreferrer");
  } catch {}
  if (!w) window.location.href = url;
}

// Saves a Blob to the user's device. The plain `<a download>` + blob-URL
// trick below is all a real browser needs, but the Android APK shell is a
// bare WebView with no download listener wired up on the native side — a
// click on a blob:/data: URL there just does nothing (no error, no file,
// nothing to catch). The Web Share API bypasses that entirely: it hands the
// bytes to Android's native share sheet (Chromium implements this itself,
// independent of the WebView host app's own download handling), where "Save
// to Files"/Drive/etc. actually write the file. We try that first on
// platforms that support sharing files, and fall back to the classic anchor
// trick everywhere else (desktop browsers, older WebViews).
export async function saveFile(blob, filename, mime) {
  try {
    if (window.WyBuild?.downloadBase64) {
      const r = new FileReader();
      const ok = await new Promise(resolve => { r.onload=()=>{ try { resolve(!!window.WyBuild.downloadBase64(filename, mime || blob.type || "application/octet-stream", String(r.result).split(",")[1] || "")); } catch { resolve(false); } }; r.onerror=()=>resolve(false); r.readAsDataURL(blob); });
      if (ok) return true;
    }
  } catch {}
  try {
    const file = new File([blob], filename, { type: mime || blob.type || "application/octet-stream" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    if (e?.name === "AbortError") return false; // user dismissed the share sheet — not a failure
    // Any other error (unsupported, permission, etc.) — fall through below.
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// "now" / "N mins ago" / "N hrs ago" / "N days ago" ... for file/folder last-modified display.
export function relativeTime(ts){
  if(!ts) return "";
  const diff=Math.max(0,Date.now()-ts);
  const sec=Math.floor(diff/1000);
  if(sec<60) return "now";
  const min=Math.floor(sec/60);
  if(min<60) return `${min} min${min===1?"":"s"} ago`;
  const hr=Math.floor(min/60);
  if(hr<24) return `${hr} hr${hr===1?"":"s"} ago`;
  const day=Math.floor(hr/24);
  if(day<30) return `${day} day${day===1?"":"s"} ago`;
  const mo=Math.floor(day/30);
  if(mo<12) return `${mo} mo${mo===1?"":"s"} ago`;
  const yr=Math.floor(mo/12);
  return `${yr} yr${yr===1?"":"s"} ago`;
}
