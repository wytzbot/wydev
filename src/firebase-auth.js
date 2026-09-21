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
  const auth=firebaseAuth();

  // Web-only authentication: use the Firebase Web SDK in a normal browser.
  // Popup is preferred because it keeps the user on the current page. If the
  // browser blocks popups or does not support the popup environment, use
  // Firebase's browser redirect flow as the web fallback. No Median/native
  // authentication bridge is used here.
  try{
    return await signInWithPopup(auth, googleProvider());
  }catch(e){
    const code=String(e?.code||"");
    // These errors mean the popup could not complete in the current
    // browser environment. Switch to the full-page Firebase redirect flow
    // instead of making the user retry the same incompatible popup.
    //
    // popup-closed-by-user is included deliberately: some browsers/WebViews
    // report a popup that they cannot keep open with this code. A real
    // cancellation is still harmless—the redirect flow simply asks the user
    // to continue with Google on the next page.
    if([
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported",
      "auth/internal-error"
    ].includes(code)){
      return signInWithRedirect(auth, googleProvider());
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
