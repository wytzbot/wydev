# WyteLab APK action fixes — 2026-10-19

## Changes
- Added a dedicated **Delete all files** action in the repository editor. It uses the complete tracked-tree index, stages deletions locally, clears the selection, and explains that a commit/push is required before GitHub changes.
- The bulk-delete action handles a missing local index by requesting the repository tree first and stops with an actionable error if that request fails.
- Added a native Android clipboard-paste bridge (`WyBuild.paste()`) and made the Paste/Replace action fall back to it when `navigator.clipboard.readText()` is blocked by WebView permissions.

## Verification performed
- `node --check api/index.js`: passed.
- `buildChangeSet` regression check: passed; removing all tracked paths yields a `D` change for every path.
- Source references for the new actions/bridge verified.

## Verification not performed
- Full Vite production build, Android/Gradle compilation, and on-device APK testing were not run in this environment because project npm dependencies / Android SDK toolchain are not installed here. This ZIP is source-patched, not a compiled APK.
