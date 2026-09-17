// The Android APK shell is a plain WebView, and Android's Doze/App Standby
// power management frequently suspends network sockets while the app is in
// the background without ever telling the renderer the connection died. On
// resume, an in-flight (or freshly issued) `fetch()` against that half-dead
// connection can simply hang forever instead of rejecting — there's no
// error, so a button's `finally { setBusy(false) }` never runs and the UI
// stays stuck on "Loading…"/"Saving…" until the whole app is reloaded.
//
// Every network call in the app should go through this so it always settles
// one way or another within a bounded time, turning "frozen forever" into a
// normal, already-handled error message.
export async function fetchTimeout(url, options = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const callerSignal = options.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError" && !callerSignal?.aborted) {
      throw new Error("The request timed out. Check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
  }
}
