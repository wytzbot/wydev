# WyteLab Marketplace SSO + reviewer access — 2026-09-21

## Added

- Google SSO account sign-in using `openid`, `email`, and `profile`.
- Existing Google Drive OAuth remains separate and continues to request only `drive.file` for Drive export.
- Google-first users receive a clear **Connect GitHub** step before repository features are available.
- Google-to-GitHub linking is protected by one-time OAuth state and the current session identity.
- Reviewer Pro access is server-side and environment-controlled; no reviewer credentials are embedded in the client or repository.

## Reviewer environment variables

```env
REVIEWER_PRO_ACCESS=true
REVIEWER_EMAILS=reviewer@example.com
REVIEWER_GITHUB_LOGINS=reviewer-github-login
```

Use the real reviewer identity supplied for Marketplace review. Keep these values in Vercel/server environment variables only.

## Important behavior

Reviewer access does not create a payment or modify billing transactions. It only makes the explicitly configured reviewer identity resolve to the Pro entitlement while the review allowlist is enabled.

## Google OAuth callback

Google SSO and Google Drive use the same production callback:

`https://wyte.name.ng/api/auth/google/callback`

The server distinguishes the one-time OAuth state so the callback cannot be reused to turn a Drive authorization into a sign-in session or vice versa.

## Build verification

- `node --check api/index.js` — PASS.
- `node scripts/check-build.mjs` — PASS for the repository's available source/security checks.
- Full Vite build could not be executed in this sandbox because dependency installation timed out; run `npm install`/`npm run build:source` in Vercel or CI before production deployment.
