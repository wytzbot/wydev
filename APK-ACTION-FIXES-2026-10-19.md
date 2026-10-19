# WyteLab APK action fix — follow-up (2026-10-19)

## Delete All Files: account/refresh regression

The previous implementation trusted cached `base`, `files`, or `fileIndex` whenever any local path existed. After account switching or restoring a cached project, this could skip fetching the current GitHub tree and stage a deletion against stale metadata.

The action now:
- Always fetches the selected repository's current tree from GitHub before showing the confirmation.
- Stops without changing local state if that refresh fails.
- Uses the freshly fetched tree SHA and file SHAs as the commit baseline.
- Ignores stale cached paths that no longer exist in the freshly fetched remote tree.
- Includes newly-created local files in the discard confirmation.
- Stages the remote files for deletion and instructs the user to open Changes and commit/push.
- Shows an explicit message when GitHub confirms the repository has no tracked files.

## Verification status

- Reviewed the updated Delete All Files flow for stale-cache/account-switch behavior.
- Full Vite production build and Android APK/device test have not been run in this environment. Rebuild and install the APK after deploying the source update; the source ZIP is not itself an installed APK.
