import {getApp, getApps, initializeApp} from "firebase/app";
import {getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithRedirect, signOut} from "firebase/auth";
import {FIREBASE_CONFIG} from "./firebase-config";
import {fetchTimeout} from "./net";

let authInstance = null;

function firebaseApp(){
  return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
}

export function firebaseAuth(){
  if (!authInstance) authInstance = getAuth(firebaseApp());
  return authInstance;
}

function googleProvider(){
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt:"select_account"});
  provider.addScope("openid");
  provider.addScope("email");
  provider.addScope("profile");
  return provider;
}

// Google authentication deliberately uses Firebase's full-page redirect flow.
// The Firebase authDomain is the same as the production WyteLab origin and the
// Vercel deployment transparently proxies /__/auth/* to Firebase. That avoids
// the third-party sessionStorage problem that caused the old
// "missing initial state" screen in Android/partitioned browsers.
export async function signInWithGoogle(){
  await signInWithRedirect(firebaseAuth(), googleProvider());
}

export async function consumeGoogleRedirect(){
  return getRedirectResult(firebaseAuth());
}

// Turn the Firebase client credential into the same encrypted WyteLab server
// session used by the rest of the app. Never put a Firebase token in a URL.
export async function establishGoogleServerSession(result){
  if (!result?.user) return null;
  const idToken = await result.user.getIdToken(true);
  const response = await fetchTimeout("/api/auth/firebase", {
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({idToken})
  }, 12000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "Google sign-in could not be completed.");
    error.code = data?.code || `HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return data?.user || null;
}

export function currentFirebaseUser(){
  return firebaseAuth().currentUser;
}

export function watchFirebaseAuth(callback){
  return onAuthStateChanged(firebaseAuth(), callback);
}

export async function signOutGoogle(){
  try { await signOut(firebaseAuth()); } catch {}
}
