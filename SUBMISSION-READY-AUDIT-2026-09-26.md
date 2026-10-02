# WyteLab Marketplace submission-ready audit — 2026-09-26

## OAuth review issue addressed

The source has been reconciled around two intentionally separate Google flows:

- **Google™ account sign-in:** Firebase Authentication → Firebase-managed redirect → Firebase ID token → `/api/auth/firebase`.
- **Google Drive™ export:** direct server OAuth → `/api/auth/google` → `https://wyte.name.ng/api/auth/google/callback`.

The repository no longer claims that these flows share a callback, and it no longer claims an Identity Toolkit fallback that is not implemented.

## Marketplace materials added/updated

- `MARKETPLACE-LISTING.md` — ready-to-paste store listing copy and reviewer test path.
- `GOOGLE-WORKSPACE-MARKETPLACE.md` — integration, OAuth, scope, reviewer, branding and screenshot guidance.
- `MARKETPLACE-SETUP-CHECKLIST.md` — production configuration checklist.
- `MARKETPLACE-SSO-REVIEWER-FIX-2026-09-21.md` — corrected OAuth architecture and reviewer notes.
- `WEB-ONLY-AUTH.md` — corrected authentication flow.

## Branding

Visible Google product references in the app/legal material now use `™` where applicable. Attribution is included:

`Google Drive™ is a trademark of Google LLC.`

`Google Workspace Marketplace™ is a trademark of Google LLC.`

WyteLab is described as independent and not endorsed by Google LLC.

## Static verification

- `node --check api/index.js`: PASS.
- `node scripts/check-build.mjs`: PASS for available source/security checks.
- Frontend secret scan: PASS through the repository check.
- `npm install`: attempted but timed out in this sandbox; therefore the Vite bundle was not claimed as verified here.

## Required before republishing

1. Deploy this revision to production.
2. Confirm Firebase Authentication has Google™ enabled and `wyte.name.ng` is an Authorized domain.
3. Confirm the direct Google OAuth client used by `GOOGLE_CLIENT_ID` has exactly:
   `https://wyte.name.ng/api/auth/google/callback`
   as an Authorized redirect URI.
4. Keep Google Auth Platform at **External** and **In production**.
5. Test both Google™ sign-in and Google Drive™ export on the production domain.
6. Upload five clear production screenshots where the Marketplace form permits them.
7. Republish/submit the updated Marketplace version.
