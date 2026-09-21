# WyteLab — Google Workspace Marketplace setup checklist

This file covers the steps that cannot be completed from source code alone.

## 1. Production deployment
- Deploy the current build to the real HTTPS production domain.
- Confirm `/`, privacy, terms, about and contact pages load without authentication.
- Confirm `/api/auth/google` and `/api/auth/google/callback` are reachable in production.
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the production environment.
- `GOOGLE_REDIRECT_URI` must exactly match the Google OAuth client's authorized redirect URI.
- Never put `GOOGLE_CLIENT_SECRET`, Firebase Admin credentials, GitHub secrets, or Flutterwave secrets in the frontend or repository.

## 2. Google APIs
Enable the APIs actually used by the production integration, including Google Drive API. Do not enable or request unrelated Workspace APIs merely for Marketplace submission.

## 3. Google Auth Platform / OAuth
Configure the production project:
- Branding: app name `WyteLab`, app logo, support email, developer contact details, homepage and privacy policy.
- Audience: use the public/external configuration required for a public Marketplace app; do not leave the app in Testing.
- Data Access: register exactly these scopes:
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/drive.file`
- OAuth client: create a Web application client and add the exact production callback URL. Browser Google SSO and Drive use `/api/auth/google/callback` and distinguish their one-time OAuth state server-side. The Median APK uses the native Google Social Login plugin and `/api/auth/google/native`; it is a separate native path, not an OAuth redirect inside the Android WebView.
- Authorized domain: add the production domain used by the app and public legal pages.
- Verification: because `drive.file` is currently a non-sensitive scope, do not claim sensitive-scope verification is required solely because of `drive.file`. Complete any brand/basic OAuth verification or other verification Google actually requests for the project.

## 4. Google Workspace Marketplace SDK
In the same Cloud project:
- Enable **Google Workspace Marketplace SDK**.
- App Configuration: choose **Public** visibility if the goal is a public Marketplace listing. This visibility choice cannot simply be changed later, so verify it before saving.
- App integration: select **Web app** because WyteLab is a production web application.
- Universal navigation URL: use the real production WyteLab web-app URL, not a staging page.
- OAuth scopes: enter the same four scopes listed above.
- Developer information: use the real solo-developer/developer-business name, website, support contact, and EEA trader/non-trader status.

## 5. Store listing
Prepare:
- App name: `WyteLab`
- Unique, non-Google-branded icon.
- Short description and detailed description that are different and accurately describe the product.
- Pricing: clearly state the actual Free/Pro pricing used by the product. Current product documentation says Pro is `$7/month` or `₦7,500/month`; update the listing if the live price changes.
- Public privacy-policy URL.
- Public terms URL.
- Public support/contact URL.
- Category.
- Production screenshots that are sharp and show real functionality.
- 48x48 and 96x96 web-app icons if requested by the current listing form, plus the required listing icon assets.

## 6. Reviewer access
Because Pro functionality exists:
- The app now supports a server-side review-only Pro allowlist. Set `REVIEWER_PRO_ACCESS=true` in production only while arranging/submitting review, then set it back to `false` after review if desired.
- Put the reviewer's Google email in `REVIEWER_EMAILS` and/or their GitHub username in `REVIEWER_GITHUB_LOGINS`. These values stay server-side and are never shipped to the browser.
- The allowlist does not create a fake payment or alter normal billing records; it only exposes Pro entitlements to the explicitly configured reviewer identity.
- Do not hard-code reviewer credentials into the ZIP or source repository.
- In the Marketplace review-access field, give the reviewer the exact sign-in path and the configured test identity/instructions.
- Include exact steps for: Google SSO, Connect GitHub, repository selection, Google Drive connection, ZIP export, Drive disconnect, and Pro feature testing.

## 7. Final production test
Before submitting:
- Sign in with Google SSO.
- Connect GitHub and confirm repository access.
- Sign out and verify the session ends.
- Sign in with GitHub directly and confirm the normal GitHub-first path still works.
- Open a private repository you are authorized to use.
- Edit and commit a harmless test change.
- Test repository actions and error states.
- Connect Google Drive.
- Export a repository ZIP.
- Confirm the ZIP appears in Drive.
- Disconnect Drive and confirm the app removes its stored Google credential and reports failure if Google revocation cannot be confirmed.
- Reconnect Drive and repeat the export.
- Test logout/login.
- Test on mobile and desktop.
- Verify no staging/development URLs appear in the Marketplace listing or OAuth configuration.

## 8. Submission order
1. Finish production deployment.
2. Configure Google Auth Platform/OAuth.
3. Create the Marketplace SDK draft configuration.
4. Complete OAuth verification if required.
5. Add the store listing and reviewer access.
6. Test the draft listing.
7. Submit the public listing for Marketplace review.
8. Do not change OAuth scopes after submission unless you are prepared to repeat the relevant verification/review steps.

## 9. Important Drive-policy note
- Keep the Drive feature as a user-requested export/copy workflow, not automatic backup or background synchronization. Google Workspace user-data policy restricts using Drive scopes for backup of app/project content. The listing and UI should describe the action as an explicit user-initiated export of a repository ZIP.
- Do not describe WyteLab as a Drive backup/sync service.
