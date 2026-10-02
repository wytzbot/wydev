# WyteLab TWA — Termux build package

This is a real Trusted Web Activity wrapper. It does **not** embed the site in an Android WebView. Chrome/Chromium hosts the existing WyteLab web app at `https://wyte.name.ng/`.

## Why this preserves app behavior

The existing project uses browser-native Firebase redirect authentication, GitHub OAuth redirects, DOM storage/cookies, service workers, Web Share, Clipboard and browser file/download APIs. A TWA keeps those APIs in the Chrome browser context instead of replacing them with a limited WebView bridge. Android Browser Helper provides the TWA launcher and a Custom Tab fallback if a TWA-capable browser is unavailable.

## Termux

From this directory:

```sh
chmod +x build-termux.sh
./build-termux.sh
```

The script checks Node/npm/Java/Gradle, installs web dependencies, runs the Vite build/check, creates a persistent release keystore on first run, prints its SHA-256 certificate fingerprint, and builds `app-release.apk`.

### Digital Asset Links is required for a toolbar-free trusted launch

After the first build, copy the generated `assetlinks.json` to the deployed website at:

`https://wyte.name.ng/.well-known/assetlinks.json`

The file must stay reachable over HTTPS with no redirect. If you change/recreate the signing keystore, regenerate the assetlinks file and redeploy it. Without this verification, Android Browser Helper falls back to a normal Custom Tab instead of a fully trusted TWA.

## Important

Do not delete `keystore/wytelab-release.jks` after releasing the APK. The same signing key is required for future updates and for the matching Digital Asset Links fingerprint. The build script will never overwrite an existing keystore.
