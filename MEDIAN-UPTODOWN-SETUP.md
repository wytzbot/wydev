# WyteLab — Median / Uptodown build setup

This release keeps the existing Vite/React web app and adds a deliberate Median native integration layer. It does **not** pretend to be a Flutter project and does not require changing the web architecture.

## Required Median App Studio configuration

Enable the JavaScript Bridge and configure these native features in the Median project used to build the APK:

1. **JavaScript Bridge** — enabled.
2. **Firebase Cloud Messaging** — enabled; upload the correct `google-services.json` for Android.
3. **Haptics** — enabled.
4. **Share into App** — enabled if you want Android users to share a GitHub URL/text into WyteLab.
5. **Download/File handling** — enabled/configured for the Android Downloads directory where appropriate.
6. **Deep links / allowed URLs** — keep the Wytelab domain and required legal/API routes allowed. During testing, do not accidentally restrict the bridge away from `https://wyte.name.ng`.
7. If using the injected Median bridge, leave bridge injection enabled. Do not also install the NPM bridge package unless the Median project is intentionally switched to the NPM-package approach.


## Remove the Chrome-style top URL bar in the APK

If the installed APK shows a top bar containing the domain, Share, and the three-dot menu, that is Median's **App Browser / Custom Tab**, not the WyteLab webpage. A webpage manifest or CSS change cannot remove that native toolbar. Median documents that same-domain URLs normally open in the main WebView, while App Browser is a separate native window.

For the APK build, configure **App Studio → Link Behavior** as follows:

1. Set the **initial WyteLab URL (`https://wyte.name.ng`) to Internal**, not App Browser.
2. Keep only the authentication pages that genuinely need a browser flow in **App Browser** if required by the OAuth setup.
3. Add the OAuth callback/success URL back to `https://wyte.name.ng` as **Internal**, so the successful login returns to the main WebView instead of leaving the app in the browser window.
4. Rebuild the Android APK after changing Link Behavior.
5. In **Interface → Full Screen**, enable **Full Screen**. This source also calls Median's native `median.screen.fullScreen()` when the bridge is available.

This distinction is important: Full Screen hides Android's system status/navigation bars, while Link Behavior controls the Chrome-style App Browser toolbar. Both settings are needed for the intended app presentation.

## What this web release adds

- A native-aware mobile bridge with safe browser fallbacks.
- Native Android/iOS share-sheet support for the Wytelab app.
- Native haptic confirmation when supported.
- Median Share into App callback (`median_share_to_app`) with a safe session handoff.
- Service-worker registration is skipped inside the native Median shell so native FCM remains the notification path in the APK.
- A visible **Android App Features** section in Settings when running inside Median.
- A Share action in the Wytelab top bar.
- Existing ZIP/file workflows continue to use Web Share as a fallback where a Blob must be handed to the device.
- Existing FCM backend/token registration remains unchanged.

## Important

This source ZIP alone cannot enable native plugins. The Median App Studio configuration and the rebuilt APK are required for the native APIs to exist on the device.

## Uptodown review goal

The purpose of these changes is to make mobile-specific functionality part of the actual Wytelab experience rather than merely displaying the website. Final acceptance remains a decision made by Uptodown's review process.
