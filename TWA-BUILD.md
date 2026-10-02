# WyteLab TWA build

Trusted Web Activity wrapper for https://wyte.name.ng (package `ng.name.wyte.app`).
Everything is driven by `twa-manifest.json` + Bubblewrap — no hand-written Android code.

## One-time setup
1. Create the signing key (keep it forever; losing it means you can't update the app):
   `keytool -genkeypair -v -keystore android.keystore -alias wytelab -keyalg RSA -keysize 2048 -validity 10000`
2. Get its fingerprint: `keytool -list -v -keystore android.keystore -alias wytelab | grep SHA256`
3. Put that value in `public/.well-known/assetlinks.json` (replace the placeholder), commit, and deploy to Vercel.
   Check: https://wyte.name.ng/.well-known/assetlinks.json must return the JSON (HTTP 200, `application/json`).
   If you publish on Google Play with Play App Signing, ALSO add Play's app-signing SHA-256
   (Play Console → App integrity) as a second entry in `sha256_cert_fingerprints`.
4. Add repository secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 android.keystore`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.

## Build
Actions → "Build WyteLab TWA (Bubblewrap)" → set versionCode (increase every release) and versionName.
Download `wytelab-twa` (signed APK for sideloading/Uptodown, AAB for Play).

Local alternative: `npm i -g @bubblewrap/cli && bubblewrap build` in this folder.

## Verify on a device
- App opens with NO URL bar. If a bar shows, assetlinks.json is wrong/unreachable or the fingerprint doesn't match the installed build's signing key.
- Test GitHub sign-in end to end (see below).

## Google sign-in (Firebase) — 2 console steps, required
`authDomain` now switches to `wyte.name.ng` in production and `vercel.json` proxies `/__/auth/*` to Firebase, so redirect sign-in works with Chrome's storage partitioning (a TWA runs on Chrome).
1. Google Cloud Console → APIs & Services → Credentials → the Web client used by Firebase Auth → add
   `https://wyte.name.ng/__/auth/handler` to **Authorized redirect URIs** (keep the existing firebaseapp.com one).
2. Firebase console → Authentication → Settings → Authorized domains: confirm `wyte.name.ng` is listed.
Without step 1 Google sign-in fails with `redirect_uri_mismatch`.

## Known risks to test
- GitHub OAuth leaves the verified origin, so Chrome shows the Custom Tab bar in the same window until GitHub redirects back to wyte.name.ng, then returns to fullscreen. The server already falls back to Firestore for the OAuth state if the cookie is lost. Confirm the app lands signed-in.
- If the GitHub mobile app is installed, Android may offer to open github.com/login links in it; if that happens, sign in via the Custom Tab instead.
- Google Drive connect (`/api/auth/google`) is a server-side redirect and behaves like GitHub.
- The older native-bridge features (share intent, deep links, local notifications, battery info) belong to `.wydev/android-shell` and do NOT exist in the TWA; the app already treats them as native-only.
