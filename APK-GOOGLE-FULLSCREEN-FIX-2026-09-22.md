# WyteLab Google + GitHub + Median Fullscreen Fix — 2026-09-22

- Restored **Sign in with Google** on the main login page.
- Google uses Firebase Web SDK `signInWithRedirect()` and `getRedirectResult()`.
- Google redirect state now uses `wyte.name.ng` as the Firebase `authDomain`.
- Added Vercel transparent rewrites for `/__/auth/*` and `/__/firebase/init.json` to the Firebase project's auth helper domain, following Firebase's documented reverse-proxy approach for non-Firebase hosting.
- After the Google redirect returns, the Firebase ID token is sent over HTTPS to `/api/auth/firebase`, which verifies it and creates the encrypted WyteLab server session.
- `Connect GitHub` now uses `/api/auth/github/connect` after Google login; it no longer replaces a Google account with a GitHub-only session.
- GitHub OAuth callback/state validation remains intact.
- Added redirect timeout/error handling so a failed OAuth return cannot leave the UI stuck indefinitely.
- Added Median `median.android.screen.fullScreen()` support while retaining the custom WyBuild bridge.
- Preserved PWA fullscreen metadata.
- Google remains the account identity flow needed for Google Workspace Marketplace compatibility; GitHub remains the repository authorization.
