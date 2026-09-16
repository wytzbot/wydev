# WyteLab Android APK build notes

The maintained Android shell now:

- launches `https://wyte.name.ng/` as the primary WebView origin;
- keeps WyteLab URLs inside the app;
- sends genuinely external destinations to the device browser only when external links are enabled;
- uses Android immersive fullscreen so system bars do not consume the app viewport;
- reapplies fullscreen when the app regains focus;
- keeps relative `/api` routes, OAuth callbacks and browser routing on the real WyteLab origin.

Build from GitHub Actions with `build_type=apk` and release mode. The workflow defaults to the `FULLSCREEN` native feature.

The repo previously also carried a leftover generic `WyBuild` workflow/shell (`.wybuild/`), copied over from the WyBuild product template. It lacked the same-origin check and persistent immersive fullscreen fix above, so building with it showed the system browser bar on navigation. It has been removed — **"WyteLab" is now the only Android build workflow in this repo.**
