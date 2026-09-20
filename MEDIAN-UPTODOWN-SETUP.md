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
