# WyDev Android APK build notes

The maintained Android shell now:

- launches `https://wydev.vercel.app/` as the primary WebView origin;
- keeps WyDev URLs inside the app;
- sends genuinely external destinations to the device browser only when external links are enabled;
- uses Android immersive fullscreen so system bars do not consume the app viewport;
- reapplies fullscreen when the app regains focus;
- keeps relative `/api` routes, OAuth callbacks and browser routing on the real WyDev origin.

Build from GitHub Actions with `build_type=apk` and release mode. The workflow defaults to the `FULLSCREEN` native feature.
