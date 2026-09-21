import {getApp, getApps, initializeApp} from "firebase/app";
import {getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithRedirect, signOut} from "firebase/auth";
import {FIREBASE_CONFIG} from "./firebase-config";

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

// Use Firebase Web Auth for both the normal browser and the APK WebView.
// Firebase handles the Google OAuth redirect; WyteLab never tries to turn a
// Google email address into a GitHub credential.
export async function signInWithGoogle(){
  return signInWithRedirect(firebaseAuth(), googleProvider());
}

export async function consumeGoogleRedirect(){
  return getRedirectResult(firebaseAuth());
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
