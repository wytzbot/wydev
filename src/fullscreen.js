// Fullscreen/immersive handling for web, PWA and the Android wrapper.
// Native Android shells get a stronger system-bar hide through WyBuild; regular
// browsers use the Fullscreen API on the first real user gesture.
function isImmersive() {
  try {
    return !!(window.matchMedia?.("(display-mode: fullscreen)").matches ||
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.fullscreenElement);
  } catch (_) { return false; }
}

function nativeFullscreen() {
  try {
    // Median Android apps expose the documented native bridge. This hides the
    // Android status/navigation bars; the website itself cannot hide Median's
    // native top navigation/App Browser toolbar, which must be disabled in
    // Median App Studio/link handling.
    if (window.median?.android?.screen?.fullScreen) {
      window.median.android.screen.fullScreen();
      return true;
    }
    if (window.gonative?.android?.screen?.fullScreen) {
      window.gonative.android.screen.fullScreen();
      return true;
    }
    if (window.WyBuild && typeof window.WyBuild.enterFullscreen === "function") {
      window.WyBuild.enterFullscreen();
      return true;
    }
  } catch (_) {}
  return false;
}

function webFullscreen() {
  try {
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (request) {
      const result = request.call(el);
      if (result?.catch) result.catch(() => {});
      return true;
    }
  } catch (_) {}
  return false;
}

export function initFullscreen() {
  // The Android wrapper can hide system bars without requiring a user gesture.
  nativeFullscreen();
  if (isImmersive()) return;

  // Browser/PWA fullscreen is restricted by Chromium to a user gesture.
  const onGesture = () => {
    nativeFullscreen();
    if (!isImmersive()) webFullscreen();
  };
  document.addEventListener("click", onGesture, { once: true, passive: true });
  document.addEventListener("touchend", onGesture, { once: true, passive: true });
}
