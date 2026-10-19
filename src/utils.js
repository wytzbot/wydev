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


export async function readClipboardText(){
  // Native Android WebViews often deny navigator.clipboard.readText even
  // though the app has a legitimate user-triggered Paste action.
  try{
    if(navigator.clipboard?.readText){
      const text = await navigator.clipboard.readText();
      if (typeof text === "string") return text;
    }
  }catch{}
  try{
    const bridge = typeof window !== "undefined" ? window.WyBuild : null;
    if (bridge?.paste) {
      const text = bridge.paste();
      if (typeof text === "string") return text;
    }
  }catch{}
  throw new Error("Clipboard access is unavailable. Copy the replacement code, then try Paste again.");
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

// Save APK exports through the native Android bridge in small chunks. Passing
// a whole ZIP as one Base64 JavaScript-interface argument can fail for larger
// repositories (and temporarily duplicates the ZIP in memory). Chunked writes
// avoid the oversized bridge call; ordinary browsers and TWA builds keep the
// share/download fallbacks below.
function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read export data."));
    reader.readAsDataURL(blob);
  });
}

async function saveViaChunkedNativeDownload(blob, filename, mime) {
  const bridge = typeof window !== "undefined" ? window.WyBuild : null;
  if (!bridge?.supportsChunkedDownloads || !bridge?.beginDownload || !bridge?.writeDownloadChunk || !bridge?.finishDownload) return false;
  try { if (!bridge.supportsChunkedDownloads()) return false; } catch { return false; }

  const type = mime || blob.type || "application/octet-stream";
  let started = false;
  let completed = false;
  try {
    started = !!bridge.beginDownload(String(filename || "download"), String(type));
    if (!started) return false;
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      const chunk = blob.slice(offset, Math.min(offset + chunkSize, blob.size));
      const dataUrl = await readAsDataUrl(chunk);
      const base64 = dataUrl.split(",")[1] || "";
      if (!bridge.writeDownloadChunk(base64)) throw new Error("Android could not write the ZIP data.");
    }
    completed = !!bridge.finishDownload();
    return completed;
  } finally {
    if (started && !completed) {
      try { bridge.cancelDownload?.(); } catch {}
    }
  }
}

// Saves a Blob to the user's device. The Android WebView shell receives files
// through its native Downloads bridge. Median-wrapped apps can use Median's
// download bridge, and Chrome/TWA/browser builds can use Web Share or a normal
// download link. Every route is feature-detected because Android containers
// expose different subsets of browser APIs.
export async function saveFile(blob, filename, mime) {
  const type = mime || blob.type || "application/octet-stream";
  try {
    if (await saveViaChunkedNativeDownload(blob, filename, type)) return true;
  } catch {}
  // Compatibility path for older native shells that only implement a single
  // Base64 download call. Newer shells use the chunked writer above.
  try {
    if (window.WyBuild?.downloadBase64) {
      const dataUrl = await readAsDataUrl(new Blob([blob], { type }));
      const ok = !!window.WyBuild.downloadBase64(String(filename || "download"), String(type), dataUrl.split(",")[1] || "");
      if (ok) return true;
    }
  } catch {}
  // Median-wrapped APK: Median exposes a dedicated download bridge.
  try {
    const m = typeof window !== "undefined" && /median|gonative/i.test(navigator.userAgent || "") ? window.median : null;
    if (m?.share?.downloadFile) {
      const dataUrl = await readAsDataUrl(new Blob([blob], { type }));
      m.share.downloadFile({ url: dataUrl, filename, open: true });
      return true;
    }
  } catch {}
  // In Chrome Android/TWA, handing a File to the native share sheet is more
  // reliable than relying on a WebView download listener for a blob: URL.
  try {
    const file = new File([blob], filename, { type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    if (e?.name === "AbortError") return false; // user dismissed the share sheet
  }
  // The maintained Android shell is a bare WebView; if its native bridge
  // refused the save and the share sheet was unavailable/cancelled, a blob:
  // anchor would silently do nothing. Report failure rather than claiming the
  // ZIP was saved. TWA/regular browsers don't expose this bridge and continue.
  if (typeof window !== "undefined" && window.WyBuild) return false;
  // Standard browsers handle this path with their Downloads manager.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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
