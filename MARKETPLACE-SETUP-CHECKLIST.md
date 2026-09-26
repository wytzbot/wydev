# WyteLab — Google Workspace Marketplace™ setup checklist

This file covers the production and Marketplace settings that cannot be completed from source code alone.

## 1. Production deployment
- Deploy the current build to the real HTTPS production domain.
- Confirm `/`, privacy, terms, about and contact pages load without authentication.
- Confirm `/api/auth/google` and `/api/auth/google/callback` are reachable in production.
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` for the optional Google Drive™ integration.
- `GOOGLE_REDIRECT_URI` must exactly match the Google OAuth client's Authorized redirect URI.
- Never put `GOOGLE_CLIENT_SECRET`, Firebase Admin credentials, GitHub secrets, or Flutterwave secrets in the frontend or repository.

## 2. Firebase Google™ account sign-in
- Firebase project: `wydev0`.
- Enable the Google provider under Firebase Authentication.
- Add the production WyteLab domain to Firebase Authentication → Settings → Authorized domains.
- Firebase's managed Google redirect handler follows:
  `https://wydev0.firebaseapp.com/__/auth/handler`
- Do not replace the Firebase callback with `/api/auth/google/callback`; that API callback belongs to Google Drive™ export.

## 3. Google Drive™ OAuth
- Enable the Google Drive API required by the production integration.
- Use a Web application OAuth client for the direct Drive integration.
- Authorized redirect URI:
  `https://wyte.name.ng/api/auth/google/callback`
- Production environment:
  `GOOGLE_REDIRECT_URI=https://wyte.name.ng/api/auth/google/callback`
- Register only the scopes actually requested by the integration: `openid`, `email`, `https://www.googleapis.com/auth/drive.file`.

## 4. Google Auth Platform / OAuth audience
- Current production target: **External** user type.
- Current production target: **In production** publishing status.
- Keep the public OAuth branding, authorized domain, support email, developer contact, homepage and privacy policy consistent with the Marketplace listing.

## 5. Google Workspace Marketplace™ SDK
- Enable Google Workspace Marketplace SDK.
- Use public visibility for the public listing.
- Integration type: Web app.
- Universal navigation URL: the real production WyteLab URL.
- Marketplace OAuth scopes must match the Drive integration's declared scopes.
- Store listing must accurately describe that Google™ account sign-in uses Firebase Authentication while Google Drive™ export uses a separate OAuth client.

## 6. Store listing
Prepare:
- App name: `WyteLab`
- Unique, non-Google-branded icon.
- Short and detailed descriptions.
- Actual live pricing.
- Public privacy policy, terms and support/contact URLs.
- Production screenshots showing actual functionality.
- Trademark attribution:
  `Google Drive™ is a trademark of Google LLC.`
  `Google Workspace Marketplace™ is a trademark of Google LLC.`
- State that WyteLab is independent and not endorsed or sponsored by Google LLC.

## 7. Reviewer access
- Create a dedicated review-safe account or server-side reviewer entitlement.
- Give the reviewer the minimum access required to test Pro features.
- Put credentials/instructions only in the official Marketplace review-access field, never in this repository or ZIP.
- Include exact steps for Google™ sign-in, GitHub connection, repository selection, Google Drive™ connection, ZIP export, Drive disconnect, and Pro testing.

## 8. Final production test
- Test Google™ sign-in.
- Test GitHub connection after Google™ sign-in.
- Open a repository and test a harmless edit/commit.
- Test Actions, issues, pull requests, releases and comparison.
- Connect Google Drive™.
- Export a repository ZIP.
- Confirm the ZIP appears in Drive.
- Disconnect Google Drive™ and verify the stored authorization is removed/revoked.
- Reconnect and repeat the export.
- Test logout/login on mobile and desktop.
- Verify no staging/development URLs appear in the Marketplace listing or OAuth configuration.

## 9. Submission order
1. Deploy the updated source.
2. Verify Firebase Google™ sign-in in production.
3. Verify the separate Google Drive™ OAuth callback in production.
4. Confirm Google Auth Platform is External + In production.
5. Complete Marketplace SDK configuration and listing.
6. Upload clear production screenshots.
7. Provide reviewer access instructions.
8. Test the draft listing.
9. Republish/submit the updated Marketplace version.
