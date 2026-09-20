// Bridge to the native `window.WyBuild` JS interface that the WyBuild
// Android shell (see .wybuild/android-shell) injects into the WebView.
// This is a *different* wrapper from median.co (see mobileBridge.js /
// notifications.js) — WyteLab's own Android build goes through this one.
// Every call is feature-detected and safe to use in a plain browser tab,
// where `window.WyBuild` simply doesn't exist.

function bridge() {
  return typeof window !== "undefined" ? window.WyBuild : null;
}

export function isWyBuildApp() {
  return !!bridge();
}

// True only when this specific build was compiled with that native feature
// enabled (see the `native_features` WyBuild workflow input) — lets the UI
// hide/skip actions the running build doesn't actually support natively.
export function hasNativeFeature(name) {
  const b = bridge();
  if (!b?.hasFeature) return false;
  try { return !!b.hasFeature(String(name || "").toUpperCase()); } catch { return false; }
}

// Short haptic pulse for meaningful in-app feedback (action succeeded/failed).
// Falls back to the standard Vibration API for other wrapped/PWA contexts.
export function nativeVibrate(ms = 20) {
  const b = bridge();
  if (b?.vibrate && hasNativeFeature("VIBRATION")) {
    try { b.vibrate(ms); return true; } catch {}
  }
  try {
    if (navigator.vibrate) return navigator.vibrate(ms);
  } catch {}
  return false;
}

// Hands text (e.g. a repository or file link) to the device's native share
// sheet. Falls back to the Web Share API, then silently no-ops (callers
// should still offer a "Copy link" affordance for that case).
export async function nativeShareText(text) {
  const b = bridge();
  if (b?.share && hasNativeFeature("SHARE")) {
    try { b.share(String(text || "")); return true; } catch {}
  }
  try {
    if (navigator.share) { await navigator.share({ text: String(text || "") }); return true; }
  } catch (e) {
    if (e?.name === "AbortError") return false;
  }
  return false;
}
