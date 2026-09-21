import {getApp, getApps, initializeApp} from "firebase/app";
import {getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut} from "firebase/auth";
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

// Prefer Firebase's popup flow so browsers/WebViews do not lose redirect
// storage between the app origin and firebaseapp.com. If the environment
// blocks popups, fall back to Firebase's redirect flow. WyteLab never tries to
// turn a Google email address into a GitHub credential.
export async function signInWithGoogle(){
  try{
    return await signInWithPopup(firebaseAuth(), googleProvider());
  }catch(e){
    const code=String(e?.code||"");
    if(["auth/popup-blocked","auth/operation-not-supported-in-this-environment","auth/cancelled-popup-request"].includes(code)){
      return signInWithRedirect(firebaseAuth(), googleProvider());
    }
    throw e;
  }
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
