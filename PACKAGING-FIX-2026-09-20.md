# WyteLab packaging fix — 2026-09-20

`APK-BUILD-NOTES.md` already documented that the leftover generic `WyBuild`
workflow/shell (`.wybuild/`, copied from the WyBuild product template) had
been removed and that `wydev-build.yml` / `.wydev/android-shell` is the only
maintained Android build path — but this zip still shipped both.

## What was wrong

- `.wybuild/android-shell/` and `.github/workflows/wybuild.yml` were still
  present alongside the maintained `.wydev/android-shell/` and
  `.github/workflows/wydev-build.yml`.
- The stale workflow builds `applicationId 'com.wybuild.wrapper'`, labels the
  app `"WyBuild App"`, and — per `APK-BUILD-NOTES.md` — lacks the
  same-origin check and the persistent immersive-fullscreen fix that the
  maintained shell has. Running it by mistake would produce an APK with the
  wrong package ID, wrong app name, and known UI bugs instead of WyteLab.

## Fix

- Deleted `.wybuild/` and `.github/workflows/wybuild.yml` entirely.
  `.wydev/android-shell` + `.github/workflows/wydev-build.yml` is now the
  only Android build path in the repo, matching what the docs already
  claimed.
- Removed the unused `idb` dependency from `package.json` (never imported
  anywhere in `src/` or `api/`).

## Verified after the fix

- `node scripts/check-build.mjs` — PASS
- All 46 `src/**/*.{js,jsx}` files re-parsed with esbuild (JSX transform) —
  PASS, no syntax errors
- All relative imports in `src/` resolve to real files — PASS
- Every bare package import used in `src/`/`api/` matches a declared
  `package.json` dependency — PASS
- `index.html` doctype/viewport, icon set, and `manifest.webmanifest` —
  unchanged, still correct
- No remaining references to the removed `.wybuild/` path anywhere in the
  repo (`src/wybuildBridge.js` and the `window.WyBuild` JS interface name in
  `.wydev/android-shell`'s `MainActivity.java` are intentional and unrelated
  — that's the bridge name the maintained shell itself injects, not a
  leftover from the removed template)
