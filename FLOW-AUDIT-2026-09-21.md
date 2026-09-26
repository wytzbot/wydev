# WyteLab Flow Audit — revised 2026-09-26

## Authentication flows

### Google™ account sign-in
1. User selects **Continue with Google™**.
2. Firebase Authentication starts the Google redirect.
3. Google returns to Firebase's managed authentication handler.
4. The Firebase Web SDK receives the authenticated user and ID token.
5. WyteLab sends the ID token to `/api/auth/firebase`.
6. Firebase Admin verifies the token server-side.
7. WyteLab creates its application session.
8. Google™ sign-in remains separate from GitHub authorization. Google-first users are then asked to connect GitHub because GitHub is the repository source of truth.

There is **no Firebase Identity Toolkit fallback** in the current implementation. If Firebase Admin is unavailable, `/api/auth/firebase` returns `GOOGLE_AUTH_NOT_CONFIGURED`; it does not silently use another verifier.

### Google Drive™ connection
1. User chooses **Save ZIP to Google Drive™**.
2. WyteLab starts the direct Google OAuth flow at `/api/auth/google`.
3. The server sends the user to Google with `openid`, `email`, and `drive.file`.
4. Google redirects to the exact production callback:
   `https://wyte.name.ng/api/auth/google/callback`
5. WyteLab exchanges the authorization code server-side and stores the encrypted refresh/access token.
6. The repository ZIP is uploaded only when the user requests the export.
7. Disconnect removes the stored authorization and attempts provider revocation.

The Google Drive™ callback is **not** the Firebase Google™ sign-in callback.

## Static flow/contract audit

- GitHub sign-in, GitHub connection after Google™ SSO, logout, and session lookup are wired.
- Repository list/create/delete, branch list/create/switch, file tree/file loading, commit, and remote-SHA conflict guard are wired.
- File/folder create/delete/rename/move/duplicate, ZIP upload, export, undo, and clipboard actions are wired to local working state and commit APIs.
- Pull requests, issues, releases, compare, star, fork, and GitHub Actions paths are wired.
- Google Drive™ export/status/disconnect are wired with the `drive.file` scope.
- Pro billing, entitlement checks, reviewer allowlist, AI diagnosis, notifications, preferences, local data clearing, navigation, and legal links are wired.

## Required production settings

- Firebase Authentication: Google provider enabled.
- Firebase Authentication: production web domain in Authorized domains.
- Firebase project: `wydev0`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the optional Google Drive™ OAuth integration.
- `GOOGLE_REDIRECT_URI=https://wyte.name.ng/api/auth/google/callback`.
- `REVIEWER_PRO_ACCESS=true` and reviewer allowlist values as needed for Marketplace review.

## Verification limits

- `node --check api/index.js`: must pass before deployment.
- Full Vite production bundle: run in CI/Vercel with dependencies installed.
- Live production end-to-end OAuth testing: required before resubmission.
