// Best-effort fullscreen for WyteLab when it's opened as a regular browser
// tab. Installed PWAs already go fullscreen via manifest.webmanifest
// (display: "fullscreen"), so this only kicks in for plain browser visits,
// where the Fullscreen API requires a user gesture to succeed.

function isAlreadyImmersive() {
  const standaloneMatch =
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = window.navigator.standalone === true;
  return standaloneMatch || iosStandalone;
}

function requestFullscreen() {
  const el = document.documentElement;
  const request =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen;
  if (request) {
    request.call(el).catch(() => {});
  }
}

export function initFullscreen() {
  if (isAlreadyImmersive()) return;
  if (!document.documentElement.requestFullscreen &&
      !document.documentElement.webkitRequestFullscreen &&
      !document.documentElement.msRequestFullscreen) {
    return; // Fullscreen API unsupported (e.g. iOS Safari) — nothing to do.
  }

  const tryEnter = () => {
    if (document.fullscreenElement) return;
    requestFullscreen();
  };

  // Fullscreen must be triggered by a genuine user gesture, so attach to
  // the first tap/click instead of firing on load.
  const onFirstGesture = () => {
    tryEnter();
    document.removeEventListener("click", onFirstGesture);
    document.removeEventListener("touchend", onFirstGesture);
  };
  document.addEventListener("click", onFirstGesture, { once: true });
  document.addEventListener("touchend", onFirstGesture, { once: true });
}
