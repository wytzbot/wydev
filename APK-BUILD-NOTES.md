# WyteLab Android APK build notes

The maintained Android shell now:

- launches `https://wyte.name.ng/` as the primary WebView origin;
- keeps WyteLab URLs inside the app;
- sends genuinely external destinations to the device browser only when external links are enabled;
- uses Android immersive fullscreen so system bars do not consume the app viewport;
- reapplies fullscreen when the app regains focus;
- keeps relative `/api` routes, OAuth callbacks and browser routing on the real WyteLab origin;
- draws edge-to-edge via `WindowCompat.setDecorFitsSystemWindows(false)` + `WindowInsetsControllerCompat`
  (replacing the old deprecated `View.SYSTEM_UI_FLAG_*` immersive flags, which on Android 11+
  gesture-nav devices frequently failed to report real insets — the app content would sit under
  the status bar and the tab bar would be pinned to the true bottom edge under the gesture pill);
- measures the real status bar / gesture bar / notch insets and injects them into the page as
  `--native-safe-top` / `--native-safe-bottom` / `--native-safe-left` / `--native-safe-right`
  CSS custom properties (`src/styles.css` prefers these over `env(safe-area-inset-*)`, which the
  WebView does not always populate reliably in this fullscreen mode). Re-injected on every
  navigation and whenever the system bars change.

Build from GitHub Actions with `build_type=apk` and release mode. The workflow defaults to the `FULLSCREEN` native feature.

The repo previously also carried a leftover generic `WyBuild` workflow/shell (`.wybuild/`), copied over from the WyBuild product template. It lacked the same-origin check and persistent immersive fullscreen fix above, so building with it showed the system browser bar on navigation. It has been removed — **"WyteLab" is now the only Android build workflow in this repo.**

## Frozen screen after returning from the background (repos/UI look empty until you tap something)

This zip only contains the web app — the native Android `WebView` host/Activity code that the GitHub Actions workflow builds isn't part of it, so some of this can only be fixed on the native side. Two separate things were happening and only one is fixable from here:

- **Data**: `src/App.jsx` already re-fetches repositories whenever the tab becomes visible again (`visibilitychange`/`pageshow`/`online` listeners), with cache fallback and retries. That was working correctly in this pass.
- **Paint**: Android WebViews frequently stop repainting after being backgrounded for a while — the DOM is already correct underneath, but the last composited frame stays on screen until *something* forces the WebView to draw a new one. A tap anywhere does this as a side effect of handling the touch event, which is exactly why tapping any bottom-tab icon "fixed" it even though that icon has nothing to do with repositories. `src/App.jsx` now forces a repaint itself (a `translateZ(0)` nudge on `#root` across two animation frames) whenever the page becomes visible again, instead of waiting on an incidental tap. This is a best-effort front-end workaround for a WebView compositor quirk and hasn't been verified on a physical device from this sandbox — if it's still visible after this change, the fix has to happen natively, by having the Activity properly call `webView.onResume()` on resume (see below).

## Wiring Median.co's native FCM plugin

`src/notifications.js` now supports two push paths and picks between them automatically based on `navigator.userAgent` (Median injects a `median`/`gonative` marker into it): the existing browser Web Push path (used when WyteLab is opened as a PWA/website), and Median's native **Firebase Cloud Messaging** plugin (used inside the Median-built app). Both paths end up with a plain FCM registration token and call the exact same `/notifications/subscribe` and `/notifications/unsubscribe` endpoints — **no backend changes were needed**, since `api/index.js` already stores raw FCM tokens (`wydev_fcm_tokens`) and sends through the Firebase Admin SDK, and Median's plugin registers straight against the same kind of token.

To finish enabling it, on the Median.co side (nothing further to do in this repo):

1. In the [Firebase console](https://console.firebase.google.com/), use the **same `wydev0` project** already configured for this app (see `src/firebase-config.js` / `sw.js`) — no need for a second Firebase project. Add an Android app (and iOS, if relevant) to it if not already present, and download `google-services.json` (and `GoogleService-Info.plist` for iOS).
2. In Median App Studio → **Build & Deploy → Google Services**, upload `google-services.json` (and the iOS plist).
3. In Median App Studio → **Native Plugins**, enable **Firebase Cloud Messaging**.
4. Rebuild the app — plugin/config changes only take effect in a new build.
5. Test with Settings → "Enable notifications" on a real device build; Median's own [demo/test-sender page](https://median.dev/firebase-messaging) is useful for sending a one-off test push straight to the token WyteLab registers.

Since this reuses the existing `wydev0` Firebase project's server key, no changes are needed to `api/index.js`'s `sendPushToUser`/`runScheduledNotifications` — a push sent to a Median-registered token is delivered exactly like a push sent to a browser-registered one.

## Actions that can silently hang or do nothing in the APK

- **Hung "Loading…"/"Saving…" buttons**: Android's Doze/App Standby power management can suspend a WebView's open network sockets while it's backgrounded without ever surfacing an error to the page — a `fetch()` made right before/after backgrounding can then hang forever instead of rejecting, so any button whose `finally` clears a busy/loading flag never runs. Every network call in `src/` (GitHub, billing, AI, preferences, notifications) now goes through a shared `fetchTimeout` helper (`src/net.js`) that aborts and turns this into a normal, already-handled error instead of an indefinite hang.
- **File/folder upload silently does nothing**: the "Upload file" control in the project file explorer is a plain `<input type="file">`, which is the most WebView-compatible way to trigger a picker — but a bare `android.webkit.WebView` only shows a file picker at all if the hosting `Activity`'s `WebChromeClient` implements `onShowFileChooser`. If the native shell doesn't implement that callback, tapping "Upload file" does nothing, with no error to catch from the JS side. This needs to be added natively; it can't be worked around from the web app.
- **JS execution pausing in the background**: if the native shell calls `webView.onPause()`/`pauseTimers()` on `Activity.onPause()` (rather than only on a real `onStop()`/backgrounding-for-real), all JS execution — timers, pending fetch callbacks, the visibility listeners above — freezes until `onResume()`/`resumeTimers()` is called back. Confirm the shell calls `resumeTimers()` promptly on resume; otherwise no front-end fix can un-stick it.
