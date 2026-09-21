# WyteLab Flow Audit — 2026-09-21

## Fixed in this pass
- Google SSO now uses the Firebase Web SDK for the normal web app and for the same web application when wrapped by Median.
- Firebase handles the Google redirect and returns a Firebase ID token to the WyteLab frontend.
- WyteLab sends that ID token to `/api/auth/firebase`; the server validates it with Firebase Admin when available, with Firebase Identity Toolkit as a fallback.
- A successful Google login creates a WyteLab session without creating or pretending to have a GitHub credential.
- GitHub remains a separate OAuth connection step after Google SSO.
- The old Median-native Google login path and old direct Google web-login path were removed to avoid competing authentication flows.

## Static flow/contract audit
- GitHub sign-in, GitHub connection after Google SSO, logout, session lookup: wired.
- Repository list/create/delete, branch list/create/switch, file tree/file loading, commit, remote-SHA conflict guard: wired.
- File/folder create/delete/rename/move/duplicate, ZIP upload, export, undo, clipboard actions: wired to local working state and commit APIs.
- Pull requests: list/create/merge paths are separated and wired.
- GitHub Actions: list runs, inspect jobs, dispatch, cancel, Pro rerun/debug: wired.
- Issues/releases/compare/star/fork: wired.
- Google Drive export/status/disconnect: wired with `drive.file` and explicit user export wording.
- Pro billing: checkout, verification, authorization, recovery, cancellation, webhook and server-side entitlement checks are wired.
- Reviewer Pro: server-only allowlist via `REVIEWER_PRO_ACCESS`, `REVIEWER_EMAILS`, `REVIEWER_GITHUB_LOGINS`.
- AI diagnosis and repository diagnosis: server-side quota and Gemini provider chain are wired.
- Notifications, preferences, local data clearing, navigation/back handling and legal links: wired.

## Verification limits
- `node --check api/index.js`: PASS.
- Release/source audit: PASS.
- Full Vite/esbuild production bundle: NOT VERIFIED in this environment because dependency installation timed out and `node_modules` is absent.
- Live production end-to-end testing: NOT VERIFIED from this environment.
- Firebase Authentication must have the Google provider enabled and the production domain listed under Authorized domains.

## Required production settings
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the optional Google Drive OAuth integration.
- `GOOGLE_REDIRECT_URI=https://wyte.name.ng/api/auth/google/callback`.
- `REVIEWER_PRO_ACCESS=true`.
- `REVIEWER_EMAILS=wytelabreview@gmail.com`.
- `REVIEWER_GITHUB_LOGINS=<secondary GitHub username used for review>`.
