# WyteLab Marketplace SSO + reviewer access — submission revision 2026-09-26

## Authentication architecture

WyteLab intentionally has two separate Google-related OAuth flows:

1. **Google™ account sign-in** uses Firebase Authentication in the web client. The frontend calls `signInWithRedirect()` and receives a Firebase ID token after the Google redirect. WyteLab sends that Firebase ID token to `/api/auth/firebase`, where Firebase Admin verifies it and the server creates the WyteLab session.
2. **Google Drive™ connection** is a separate server-side OAuth flow used only when the user chooses **Save ZIP to Google Drive™**. It uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`, and its callback is `/api/auth/google/callback`.

These flows must not be described as sharing the same callback. Firebase owns the sign-in redirect handler; the WyteLab API callback is only for the optional Google Drive™ integration.

## Firebase Google™ sign-in configuration

The production Firebase project is `wydev0`. Confirm in Firebase Authentication that the Google provider is enabled and that the production WyteLab domain is listed under Authorized domains.

The Firebase-managed OAuth handler follows this pattern:

```text
https://wydev0.firebaseapp.com/__/auth/handler
```

Do **not** replace the Firebase sign-in flow with `/api/auth/google/callback`.

## Google Drive™ OAuth configuration

The direct Google OAuth client used by `GOOGLE_CLIENT_ID` must have this exact Authorized redirect URI:

```text
https://wyte.name.ng/api/auth/google/callback
```

Production environment variables:

```env
GOOGLE_CLIENT_ID=<production web OAuth client ID>
GOOGLE_CLIENT_SECRET=<server-only secret>
GOOGLE_REDIRECT_URI=https://wyte.name.ng/api/auth/google/callback
```

The Google Drive™ flow requests only:

- `openid`
- `email`
- `https://www.googleapis.com/auth/drive.file`

The `drive.file` permission is used for repository ZIP snapshots created by WyteLab.

## Reviewer access

```env
REVIEWER_PRO_ACCESS=true
REVIEWER_EMAILS=reviewer@example.com
REVIEWER_GITHUB_LOGINS=reviewer-github-login
```

Use the actual reviewer identity supplied for Marketplace review. Keep these values in Vercel/server environment variables only.

Reviewer access does not create a payment or modify billing transactions. It only makes the explicitly configured reviewer identity resolve to the Pro entitlement while the review allowlist is enabled.

## Google branding attribution

Google product names appearing in Marketplace-facing copy use the `™` symbol. The detailed listing and privacy materials include this attribution:

> Google Drive™ is a trademark of Google LLC.

> Google Workspace Marketplace™ is a trademark of Google LLC.

WyteLab is an independent product and is not endorsed by, sponsored by, or affiliated with Google LLC.

## Build verification

- `node --check api/index.js` — required and verified for this revision.
- `node scripts/check-build.mjs` — should be run in the deployment environment.
- Full Vite production build depends on installing the repository dependencies.
- Live Google OAuth testing must be completed against the production domain before Marketplace resubmission.
