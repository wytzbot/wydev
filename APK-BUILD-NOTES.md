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
