import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, getRedirectResult, signInWithRedirect, signOut } from "firebase/auth";
import { FIREBASE_CONFIG } from "./firebase-config";

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
export const firebaseAuth = getAuth(app);
// Account sign-in uses Firebase Authentication. Firebase owns the Google OAuth redirect
// handler; this is intentionally separate from the direct Google Drive OAuth callback
// implemented by /api/auth/google/callback.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function startGoogleSignIn() {
  await signInWithRedirect(firebaseAuth, googleProvider);
}

export async function finishGoogleSignIn() {
  return getRedirectResult(firebaseAuth);
}

export async function firebaseSignOut() {
  try { await signOut(firebaseAuth); } catch {}
}
