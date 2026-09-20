# WyteLab — Google Workspace Marketplace

## Integration
WyteLab is submitted as a **Web app** with a focused Google Workspace integration through Google Drive. Users can optionally connect Drive and save a repository ZIP snapshot to their Drive. GitHub remains the source of truth for repositories.

### Google OAuth scope
- `https://www.googleapis.com/auth/drive.file` — only for files WyteLab creates/opens through the Drive integration.

No Gmail, Calendar, Docs, Sheets, or full-Drive permissions are requested.

## Pricing
- Free: core repository editing, browsing, Actions inspection, issues, pull requests, releases, compare, and other basic tools.
- Pro: **$7/month** or **₦7,500/month**.
- Pro unlocks higher repository access, higher AI diagnostic limits, repository revert, failed workflow reruns/debug reruns, and other clearly marked Pro controls.

The Marketplace listing should identify WyteLab as the seller and display the total mandatory price clearly.

## Reviewer flow
1. Open WyteLab from the Marketplace listing.
2. Sign in with GitHub.
3. Open Developer Hub and select a repository.
4. Test Issues, Pull Requests, Compare, Releases and Actions.
5. Test **Save ZIP to Google Drive**; Google authorization should be requested only when the Drive feature is first used.
6. Test Pro controls with a Pro reviewer account where required.

## Production environment variables
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` must be configured in the production deployment. The redirect URI should be the exact HTTPS production callback URL.
