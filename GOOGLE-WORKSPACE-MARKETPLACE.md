# WyteLab — Google Workspace Marketplace™ submission

## Product and integration

WyteLab is an independent mobile-friendly developer workspace for GitHub repositories. Its Google Workspace integration is focused on an optional Google Drive™ export: a user can authorize WyteLab to save a repository ZIP snapshot to their Drive. GitHub remains the source of truth for repository data.

WyteLab is not endorsed by, sponsored by, or affiliated with Google LLC.

## Google™ authentication vs Google Drive™ integration

These are separate flows:

- **Account sign-in:** Firebase Authentication handles **Continue with Google™**. Firebase returns an ID token to WyteLab, and the server verifies that token with Firebase Admin.
- **Drive export:** the optional **Save ZIP to Google Drive™** feature uses a separate server-side Google OAuth client and the callback `https://wyte.name.ng/api/auth/google/callback`.

Do not configure or document `/api/auth/google/callback` as the Firebase sign-in callback.

## Google Drive™ scopes

The direct Drive integration requests only:

- `openid`
- `email`
- `https://www.googleapis.com/auth/drive.file`

No Gmail, Calendar, Docs, Sheets, or full-Drive permissions are requested.

## Production OAuth settings

For the direct Drive OAuth client, the exact Authorized redirect URI is:

```text
https://wyte.name.ng/api/auth/google/callback
```

For Firebase Google™ sign-in, confirm the Google provider is enabled and `wyte.name.ng` is an Authorized domain in Firebase Authentication. The Firebase-managed redirect handler is:

```text
https://wydev0.firebaseapp.com/__/auth/handler
```

The Google Auth Platform audience is currently intended to be **External** and **In production**, as required for a public OAuth/Marketplace submission.

## Reviewer flow

1. Open WyteLab from the Marketplace listing.
2. Choose **Continue with Google™** or GitHub.
3. If Google™ sign-in is selected, connect GitHub because GitHub is the repository source of truth.
4. Open Developer Hub and select a repository.
5. Test Issues, Pull Requests, Compare, Releases and Actions.
6. Test **Save ZIP to Google Drive™**; Google authorization is requested only when this feature is first used.
7. Test **Disconnect Google Drive™**.
8. Test Pro controls with the configured reviewer entitlement.

## Google branding attribution

> Google Drive™ is a trademark of Google LLC.

> Google Workspace Marketplace™ is a trademark of Google LLC.

Use the same attribution in the detailed Marketplace listing if Google product names are mentioned there.

## Pricing

Current product documentation: Free core access and Pro at **$7/month** or **₦7,500/month**. The Marketplace listing must match the live product price.

## Listing assets

Provide production screenshots only. Use clear screenshots of the actual WyteLab interface; do not include browser chrome, OS status bars, or unrelated information. Target 1280×800 where the Marketplace form permits it.
