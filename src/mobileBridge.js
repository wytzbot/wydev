// WyteLab mobile integration layer.
// This file is intentionally safe in a normal browser: every native call is
// feature-detected and returns false instead of breaking the web app.

let readyPromise = null;

function nativeObject() {
  if (typeof window === "undefined") return null;
  return window.median || window.gonative || null;
}

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  const m = nativeObject();
  if (m) return true;
  return /median|gonative/i.test(navigator.userAgent || "");
}

export function waitForNativeBridge(timeout = 6000) {
  if (!isNativeApp()) return Promise.resolve(null);
  if (nativeObject()) return Promise.resolve(nativeObject());
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(nativeObject());
    };
    const timer = setTimeout(finish, timeout);
    const previous = window.median_library_ready;
    window.median_library_ready = () => {
      try { previous?.(); } catch {}
      finish();
    };
  });
  return readyPromise;
}

export async function nativeShare({ url, text } = {}) {
  const bridge = await waitForNativeBridge();
  try {
    if (bridge?.share?.sharePage) {
      bridge.share.sharePage({ url: url || window.location.href, ...(text ? { text } : {}) });
      return true;
    }
  } catch {}
  return false;
}

export async function nativeHaptic(style = "impactLight") {
  const bridge = await waitForNativeBridge(2500);
  try {
    if (bridge?.haptics?.trigger) {
      bridge.haptics.trigger({ style });
      return true;
    }
  } catch {}
  return false;
}

// Median Share into App calls this global function when a URL is shared from
// another Android/iOS app. The app stores the payload so React can consume it
// after launch or after a WebView resume.
export function installShareIntoAppHandler(onShared) {
  if (typeof window === "undefined") return () => {};
  const handler = (data) => {
    if (!data) return;
    const payload = {
      url: typeof data === "string" ? data : String(data.url || ""),
      subject: typeof data === "object" ? String(data.subject || "") : "",
    };
    if (!payload.url && !payload.subject) return;
    try { sessionStorage.setItem("wytelab:shared", JSON.stringify(payload)); } catch {}
    onShared?.(payload);
  };
  const previous = window.median_share_to_app;
  window.median_share_to_app = handler;
  return () => {
    if (window.median_share_to_app === handler) window.median_share_to_app = previous;
  };
}

export function consumeSharedPayload() {
  try {
    const raw = sessionStorage.getItem("wytelab:shared");
    if (!raw) return null;
    sessionStorage.removeItem("wytelab:shared");
    return JSON.parse(raw);
  } catch { return null; }
}

export function suppressWebServiceWorkerInNative() {
  return isNativeApp();
}
