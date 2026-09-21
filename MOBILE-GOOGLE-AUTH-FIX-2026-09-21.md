# Mobile Google Authentication Fix — 2026-09-21

## Problem
Median/native Android WebView showed `auth/popup-closed-by-user` after tapping Continue with Google.

## Fix
- Native/Median environments now use Firebase `signInWithRedirect()` directly instead of `signInWithPopup()`.
- Normal browsers continue to use popup authentication, with redirect fallback for popup-blocked/unsupported environments.
- The redirect callback uses `redirectResult.user` when available before falling back to Firebase `currentUser`.
- Added explicit handling for popup/redirect cancellation errors.

## Expected mobile flow
Continue with Google → Google account selection/consent → return to WyteLab → Firebase ID token exchange → WyteLab session → Connect GitHub.
