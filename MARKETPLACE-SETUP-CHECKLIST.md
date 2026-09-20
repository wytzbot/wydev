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
  - `https://www.googleapis.com/auth/drive.file`
- OAuth client: create a Web application client and add the exact production callback URL.
- Authorized domain: add the production domain used by the app and public legal pages.
- Verification: submit the OAuth app for verification as required. Provide the requested scope justifications and demo video/materials if Google asks for them.

## 4. Google Workspace Marketplace SDK
In the same Cloud project:
- Enable **Google Workspace Marketplace SDK**.
- App Configuration: choose **Public** visibility if the goal is a public Marketplace listing. This visibility choice cannot simply be changed later, so verify it before saving.
- App integration: select **Web app** because WyteLab is a production web application.
- Universal navigation URL: use the real production WyteLab web-app URL, not a staging page.
- OAuth scopes: enter the same three scopes listed above.
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
- Create a dedicated reviewer/test account or another review-safe access mechanism.
- Give the reviewer the minimum access needed to test paid features without requiring them to pay.
- Put the credentials/instructions only in the official review/test-access field, never in this repository or ZIP.
- Include exact steps for: GitHub sign-in, repository selection, Google Drive connection, ZIP export, Drive disconnect, and Pro feature testing.

## 7. Final production test
Before submitting:
- Sign in with GitHub.
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
