import {Github, Globe2, LogOut} from "lucide-react";
import {useEffect, useState} from "react";
import {toastError} from "../toast";
import {github} from "../github";
import {API_BASE_URL} from "../config";
import {consumeGoogleRedirect, currentFirebaseUser, signInWithGoogle} from "../firebase-auth";

const googleMessages={
  "auth/unauthorized-domain":"Google sign-in is not enabled for this website domain yet. Add the WyteLab domain under Firebase Authentication → Settings → Authorized domains.",
  "auth/operation-not-supported-in-this-environment":"Google popup sign-in is not supported here. WyteLab will use the secure redirect sign-in instead.",
  "auth/network-request-failed":"Google sign-in could not reach Firebase. Check your connection and try again.",
  "auth/popup-blocked":"The browser blocked the Google popup. WyteLab will use the secure redirect sign-in instead.",
  "auth/popup-closed-by-user":"The Google popup could not complete. WyteLab will use the secure redirect sign-in instead.",
  "auth/cancelled-popup-request":"Google sign-in was cancelled. Please try again.",
  "auth/redirect-cancelled-by-user":"Google sign-in was cancelled. Please try again.",
  "FIREBASE_AUTH_NOT_CONFIGURED":"Google sign-in is not configured on the WyteLab server yet.",
  "FIREBASE_TOKEN_INVALID":"Google sign-in could not be verified. Please try again.",
  "FIREBASE_TOKEN_AUDIENCE_INVALID":"This WyteLab Firebase project is not configured correctly for Google sign-in.",
};

function messageFor(error){
  const code=String(error?.code||"");
  return googleMessages[code] || error?.message || "Google sign-in could not be completed. Please try again.";
}

async function exchangeFirebaseUser(user){
  if(!user) return null;
  const idToken=await user.getIdToken(true);
  const response=await fetch(`${API_BASE_URL}/auth/firebase`,{
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({idToken}),
  });
  let data=null;
  try{data=await response.json();}catch{}
  if(!response.ok){
    const error=new Error(data?.error||"Google sign-in could not be completed.");
    error.code=data?.code; error.status=response.status;
    throw error;
  }
  return data;
}

export default function Login({githubRequired=false}){
  const [busy,setBusy]=useState(false);
  const [initializing,setInitializing]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        // Firebase stores the Google session separately from WyteLab's server
        // session. This also completes the return leg after signInWithRedirect.
        const redirectResult=await consumeGoogleRedirect();
        const user=redirectResult?.user || currentFirebaseUser();
        if(user && !githubRequired){
          setBusy(true);
          await exchangeFirebaseUser(user);
          if(alive) window.location.replace("/");
          return;
        }
      }catch(e){
        if(alive) setError(messageFor(e));
      }finally{
        if(alive){setBusy(false);setInitializing(false);}
      }
    })();
    return()=>{alive=false};
  },[githubRequired]);

  const googleSignIn=async()=>{
    setBusy(true);setError("");
    try{await signInWithGoogle();}
    catch(e){setBusy(false);setError(messageFor(e));toastError(messageFor(e));}
  };

  const connectGitHub=()=>{setBusy(true);window.location.href=`${API_BASE_URL}/auth/github/connect`};

  return <main className="login"><div className="loginBox">
    <div className="brand">WyteLab</div>
    <h1>{githubRequired?"Connect GitHub to continue.":"Code on the move."}</h1>
    <p>{githubRequired?"Your Google account is signed in. Connect GitHub so WyteLab can access the repositories you choose.":"Edit, organize, diagnose and push GitHub projects from your browser."}</p>
    {githubRequired ? (
      <button className="primary wide" disabled={busy} onClick={connectGitHub}><Github size={19}/>{busy?"Opening GitHub…":"Connect GitHub"}</button>
    ) : <>
      <button className="primary wide" disabled={busy||initializing} onClick={googleSignIn}><Globe2 size={19}/>{busy?"Signing in…":"Continue with Google"}</button>
      <button className="secondary wide" disabled={busy} onClick={github.login}><Github size={19}/>Continue with GitHub</button>
    </>}
    {githubRequired && <button className="ghost wide loginSignout" disabled={busy} onClick={async()=>{setBusy(true);await github.logout().catch(()=>{});window.location.replace("/");}}><LogOut size={17}/>Sign out</button>}
    {error && <p className="error">{messageFor({message:error})}</p>}
    <small>{githubRequired?"Google SSO creates the WyteLab account session; GitHub remains the source of truth for repository access.":"Google sign-in uses Firebase Authentication. After Google signs in, connect GitHub separately for repository access. WyteLab does not host your repositories."}</small>
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
