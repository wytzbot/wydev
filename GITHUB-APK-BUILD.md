# GitHub APK + AAB build (Play Store ready)

Workflow: **Actions -> WyteLab -> Run workflow** (`.github/workflows/wydev-build.yml`).

Inputs: `build_type` (both / aab / apk), `build_mode` (release / debug), `version_code` (must go up on every Play upload), `version_name`.

Output artifact: `WyteLab-<version>.aab` (upload this to Play) and `WyteLab-<version>.apk` (sideload / other stores), plus SHA256SUMS.

Play compliance built in: targetSdk/compileSdk 36, AGP 8.10.1, AAB signed with your upload key, versionCode injected per build.

## One-time: create the upload key (keep it forever)

```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks     # macOS: base64 -i upload.jks
```

Add these repo secrets (Settings -> Secrets and variables -> Actions):
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.

In Play Console, enable **Play App Signing** (default for new apps) and upload the .aab. Release builds fail on purpose if secrets are missing, so a throwaway key can never reach the store.
