# WyteLab native Android shell

This is the maintained Android host used for the WyteLab APK/AAB workflow. It is not a Median/GoNative project.

The host loads the WyteLab application at `https://wyte.name.ng/` and injects a native `window.WyBuild` bridge. Native capabilities include Android file picking, Downloads, sharing, clipboard, vibration, fullscreen, external URL handling, network/device information, local notifications, encrypted Android Keystore storage, deep-link/share intents, and WebView lifecycle handling.

Build through `.github/workflows/wydev-build.yml` with `build_type=apk` or `aab`. The workflow substitutes the selected native feature flags before compiling.
