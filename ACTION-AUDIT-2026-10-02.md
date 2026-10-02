# WyteLab Action Audit — 2026-10-02

## Result

The uploaded TWA source was audited across the frontend action handlers, the GitHub API routes, authentication/session paths, browser/TWA capabilities, and release packaging.

### Fixed in this pass

1. **Commit & Push:** changed the Git tree construction to use GitHub's supported `base_tree + delta entries` model. Deletions now use `sha: null`; modified executable/symlink modes are preserved when known. This avoids rebuilding entire repository trees and greatly reduces push payload size.
2. **TWA launcher:** corrected the Java source filename/class mismatch (`WyteLabLauncherActivity.java`).
3. **TWA package identity:** aligned the Android namespace/application ID, Bubblewrap package ID, launcher package, and Digital Asset Links package to `ng.name.wyte.app`.
4. **OAuth callback:** tightened one-time OAuth state validation so a matching cookie alone is not accepted when the corresponding state record has disappeared.
5. **Clipboard replace:** added a bounded browser clipboard helper and consistent error handling for TWA/Chrome clipboard access.
6. **TWA share target:** added Web Share Target manifest support and converts shared title/text/url query parameters into WyteLab's existing pending-share flow.
7. **Build audit:** added TWA consistency checks to `npm run check` so package/launcher/asset-links mismatches fail before release.

## Action coverage

| Area | Actions checked | Backend/UI contract |
|---|---|---|
| Authentication | GitHub OAuth, Google/Firebase sign-in, logout, session restore | PASS |
| Repositories | list, refresh, create, cached recovery, delete | PASS |
| Project loading | branch list, tree load, lazy file load, empty repository | PASS |
| Files | create, folder create/delete, file delete, rename, upload/ZIP import, discard | PASS |
| Git | branch creation/switch, commit & push, commit history, Pro revert | PASS after fix |
| Pull requests | create/list/compare/merge | PASS |
| GitHub Actions | list runs, inspect jobs, dispatch, cancel, rerun failed jobs | PASS |
| GitHub Hub | issues, releases, compare, star/unstar, fork | PASS |
| Google Drive | connect/status, export ZIP, disconnect | PASS |
| AI | repository diagnosis, quota/plan enforcement, copy report | PASS |
| Billing | checkout, authorization/OTP/redirect, verification/recovery, cancel | PASS |
| Browser/device | clipboard, download/share, external links, offline state | PASS with TWA-safe fallbacks |
| TWA | verified origin, fullscreen, portrait, HTTPS links, share target | PASS after package/launcher fixes |

## Verification performed

- `node --check api/index.js` — PASS
- JavaScript source syntax checks for plain `.js` files — PASS
- `node scripts/check-build.mjs` — PASS for all checks that do not require installed npm dependencies
- TWA package/application/namespace/launcher/asset-links consistency — PASS
- GitHub REST Git Trees behavior cross-checked against current GitHub documentation.

The local sandbox did not have the npm dependency tree installed and repeated `npm install` attempts timed out, so the Vite/esbuild JSX transform and installed-package icon-export check could not be executed here. The supplied Termux build performs those checks locally before assembling the APK.
