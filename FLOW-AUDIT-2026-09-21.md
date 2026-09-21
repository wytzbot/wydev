# WyteLab Flow Audit — 2026-09-21

## Fixed in this pass
- Google SSO in ordinary browsers continues to use the secure server-side OAuth code flow.
- Google SSO inside Median Android/iOS builds now uses Median Native Social Login → Google instead of attempting Google OAuth inside the Android WebView. Google documents that Sign-In with Google is not supported in Android WebViews; Median documents the native Social Login bridge for this exact use case.
- Native Google login receives an ID token through Median and sends it to a server endpoint. The server validates the token with Google's tokeninfo endpoint, verifies the audience against `GOOGLE_CLIENT_ID` and optional `GOOGLE_NATIVE_CLIENT_IDS`, requires a verified email, then creates the same WyteLab Google session.
- Native login uses a one-time state stored in a Secure HttpOnly SameSite cookie to prevent callback CSRF.
- Login UI now reports native Google configuration failures instead of silently returning to the login screen.

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
- Median native Google login requires enabling **Native Plugins → Social Login → Google** and rebuilding the APK.

## Required production settings
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for browser Google OAuth.
- `GOOGLE_REDIRECT_URI=https://wyte.name.ng/api/auth/google/callback`.
- Optional `GOOGLE_NATIVE_CLIENT_IDS` if Median returns an ID-token audience different from the web client ID.
- `REVIEWER_PRO_ACCESS=true`.
- `REVIEWER_EMAILS=wytelabreview@gmail.com`.
- `REVIEWER_GITHUB_LOGINS=<secondary GitHub username used for review>`.
