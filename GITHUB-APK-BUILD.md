# GitHub APK build

This repository contains a real Android application shell under `.wydev/android-shell/`.
The shell is compiled with Android Gradle Plugin/Gradle on GitHub Actions and exposes native
Android capabilities to the WyteLab web application through the Android `WebView` bridge.

## One-click APK build

1. Push this repository to GitHub.
2. Open **Actions → Build WyteLab APK**.
3. Select `release`.
4. Enter a new `version_code` for each update and the matching `version_name`.
5. Run the workflow.
6. Open the completed workflow and download the `WyteLab-Android-*` artifact.

The workflow builds the React/Vite web application first, packages its output into the maintained
Android shell, compiles the Android app, signs the APK, verifies the APK signature, and publishes
the APK plus SHA-256 checksum as a GitHub Actions artifact.

## Store-release signing

For a real store update, use one permanent Android keystore. In the GitHub repository's
**Settings → Secrets and variables → Actions**, add:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`

The workflow accepts a temporary key when those secrets are absent so that a test APK can still
be produced. A temporary key should **not** be used for a production update because the signing
identity must remain stable across updates.

## What makes the APK an Android package

The artifact is not an APK-shaped ZIP renamed from the website. The workflow:

- compiles an Android `Activity`;
- uses an Android `WebView` with a native `WebChromeClient` file picker;
- includes Android permissions and application metadata;
- exposes the native bridge used by the web app;
- handles Android back navigation;
- handles downloads through Android `DownloadManager`;
- supports Android share/deep-link intents;
- applies Android edge-to-edge/fullscreen behavior;
- is signed and signature-verified before the release artifact is uploaded.

The web application remains connected to its real WyteLab service at `https://wyte.name.ng/`,
so GitHub OAuth, GitHub API operations, billing, and server-side functionality continue to use
the same production backend.

## Uptodown note

This build process produces a normal signed Android APK, but no build configuration can guarantee
approval by Uptodown. Store approval is determined by the store's current review rules and the
actual behavior/content of the submitted app. Do not describe the app as fully native if its UI
is delivered through WebView.
