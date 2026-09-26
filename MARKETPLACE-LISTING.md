# WyteLab — Google Workspace Marketplace™ listing copy

## App name

WyteLab

## Short description

Mobile-friendly developer workspace for GitHub repositories, code editing, Actions, diagnostics, and optional Google Drive™ ZIP exports.

## Detailed description

**WyteLab** is a mobile-friendly developer workspace that brings GitHub repository browsing, file editing, changes, commits, Actions, issues, pull requests, releases, comparison tools, and diagnostics into one focused interface.

### What you can do

- Browse and edit GitHub repositories from a phone or desktop.
- Create, rename, move, duplicate, upload, and delete files and folders.
- Review changes and commit directly to GitHub.
- Inspect GitHub Actions runs and jobs.
- Work with issues, pull requests, releases, branches, comparisons, stars, and forks.
- Run repository and code diagnostics.
- Optionally export a repository ZIP snapshot to Google Drive™.
- Disconnect the Google Drive™ authorization from inside WyteLab.

### Google account sign-in

WyteLab supports **Continue with Google™** through Firebase Authentication. Google™ account sign-in and GitHub repository authorization are separate: when a user signs in with Google™, WyteLab asks them to connect GitHub before repository features are available because GitHub remains the source of truth for repository access.

### Google Drive™ integration

Google Drive™ is optional. Authorization is requested only when the user chooses to save a repository ZIP to Drive. WyteLab requests `openid`, `email`, and `https://www.googleapis.com/auth/drive.file`; it does not request full Drive access, Gmail, Calendar, Docs, or Sheets permissions.

### Pricing

The core workspace is available on the Free plan. Pro is **$7/month** or **₦7,500/month** and unlocks the Pro controls shown in the product.

### Independence and trademark attribution

WyteLab is an independent product and is not endorsed by, sponsored by, or affiliated with Google LLC.

Google Drive™ is a trademark of Google LLC.

Google Workspace Marketplace™ is a trademark of Google LLC.

## Reviewer test path

1. Open the production WyteLab URL.
2. Select **Continue with Google™** and complete Google™ sign-in.
3. Connect the reviewer GitHub account when prompted.
4. Open Developer Hub and choose a repository.
5. Test repository editing, commit, Actions, issues, pull requests, releases, and comparison.
6. Select **Save ZIP to Google Drive™** and complete the Drive authorization.
7. Confirm the ZIP is created in the user's Drive.
8. Select **Disconnect Google Drive™** and confirm the connection is removed.
9. Test the Pro-only features using the reviewer entitlement supplied separately in the Marketplace review-access field.

Reviewer credentials/secrets are intentionally not stored in this ZIP.
