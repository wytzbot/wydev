# WyteLab — Google Workspace Marketplace

## Integration
WyteLab is submitted as a **Web app** with a focused Google Workspace integration through Google Drive. Users can optionally connect Drive and save a repository ZIP snapshot to their Drive. GitHub remains the source of truth for repositories.

### Google OAuth scopes
- `openid` — signs the user into WyteLab with Google and identifies the Google account.
- `email` — identifies the Google account used for the WyteLab session.
- `profile` — provides the Google account name/avatar shown in the account session.
- `https://www.googleapis.com/auth/drive.file` — only for files WyteLab creates/opens through the Drive integration.

No Gmail, Calendar, Docs, Sheets, or full-Drive permissions are requested. Google SSO is an account sign-in; GitHub remains the source of truth for repository access, so a Google-first user is prompted to connect GitHub before using repository features.

## Pricing
- Free: core repository editing, browsing, Actions inspection, issues, pull requests, releases, compare, and other basic tools.
- Pro: **$7/month** or **₦7,500/month**.
- Pro unlocks higher repository access, higher AI diagnostic limits, repository revert, failed workflow reruns/debug reruns, and other clearly marked Pro controls.

The Marketplace listing should identify WyteLab as the seller and display the total mandatory price clearly.

## Reviewer flow
1. Open WyteLab from the Marketplace listing.
2. Click **Continue with Google** to use one-click Google SSO.
3. If this is the first sign-in for that Google account, click **Connect GitHub**; GitHub remains the source of truth for repository access.
4. Select a repository and test Issues, Pull Requests, Compare, Releases and Actions.
5. Test **Save ZIP to Google Drive**; Drive authorization is requested only when the Drive export feature is used.
6. Test **Disconnect Drive** (shown in Developer Hub once connected) — confirms WyteLab revokes the grant and deletes the stored token.
7. Test Pro controls with the review identity configured through the server-side reviewer allowlist.

## Production environment variables
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` must be configured in the production deployment. The redirect URI should be the exact HTTPS production callback URL.

## OAuth consent screen / verification checklist (Cloud Console — done outside this repo)
- App name, logo, support email and developer contact match what's shown in the app.
- Application home page = the production URL of `index.html` (the pre-login screen now links Privacy Policy / Terms / About / Contact in its footer, which Google's review checks for).
- Authorized domain = the production domain; `GOOGLE_REDIRECT_URI` must be an exact HTTPS match under it.
- Privacy Policy URL = the public production privacy-policy page (it must disclose `openid`, `email`, `profile`, and `drive.file`, Limited Use compliance, and how to revoke access) and Terms of Service URL = the public production terms page.
- Scopes requested must exactly match what's registered on the consent screen: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file`. `drive.file` is a **non-sensitive** Drive scope. Google recommends it for narrow per-file access; broad Drive scopes such as `drive` are restricted. Follow the current OAuth/Marketplace verification prompts for the exact project configuration.
- Workspace Marketplace SDK → Store Listing needs: 128x128+ app icon, at least one 1280x800 screenshot, short/long description, support link, category, and the same Privacy Policy/Terms URLs as above. These listing assets are submitted directly in Cloud Console and aren't part of this codebase.
- Submit for verification once the above is filled in; expect it to take days, and don't change the requested scopes afterward without re-submitting.
