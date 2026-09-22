import {Github, LogOut} from "lucide-react";
import {useState} from "react";
import {toastError} from "../toast";
import {github} from "../github";
import {signInWithGoogle, signOutGoogle} from "../firebase-auth";

function authMessage(error){
  const code=String(error?.code||"");
  const messages={
    "GITHUB_REQUIRED":"Connect your GitHub account to continue.",
    "OAUTH_STATE_MISSING":"The GitHub sign-in session expired. Start again.",
    "OAUTH_PROVIDER_MISMATCH":"The GitHub authorization could not be verified. Start again.",
    "SESSION_EXPIRED":"Your sign-in session expired. Start again.",
    "GITHUB_TOKEN_EXCHANGE_FAILED":"GitHub authorization could not be completed. Please try again.",
    "NETWORK_ERROR":"Could not reach GitHub. Check your connection and try again.",
    "FIREBASE_TOKEN_INVALID":"Google sign-in could not be verified. Please try again.",
    "FIREBASE_EMAIL_NOT_VERIFIED":"Your Google account email must be verified.",
    "FIREBASE_TOKEN_EXPIRED":"Your Google sign-in expired. Please sign in with Google again."
  };
  return messages[code] || error?.message || "Sign-in could not be completed. Please try again.";
}

export default function Login({githubRequired=false}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const signInGoogle=async()=>{
    setBusy(true); setError("");
    try{
      // This intentionally does not use a popup. The browser leaves WyteLab,
      // authenticates at Google, then Firebase returns to the same origin and
      // App.jsx exchanges the result for the server session.
      await signInWithGoogle();
    }catch(e){
      setBusy(false);
      const message=authMessage(e); setError(message); toastError(message);
    }
  };

  const connectGitHub=()=>{
    setBusy(true); setError("");
    try{
      // If Google has already established the WyteLab account session, this is
      // the account-link flow. It must NOT call /auth/github because that would
      // replace the Google session with a GitHub-only account.
      github.connectGitHub();
    }catch(e){
      setBusy(false);
      const message=authMessage(e); setError(message); toastError(message);
    }
  };

  const signOut=async()=>{
    setBusy(true);
    try{await github.logout();}catch{}
    await signOutGoogle();
    window.location.replace("/");
  };

  return <main className="login"><div className="loginBox">
    <div className="brand">WyteLab</div>
    <h1>{githubRequired?"Connect GitHub to continue.":"Sign in to WyteLab."}</h1>
    <p>{githubRequired
      ? "Your Google account is connected. Now authorize GitHub so WyteLab can work with the repositories you choose."
      : "Edit, organize, diagnose and push GitHub projects from your browser or Android app."}</p>

    {!githubRequired && <button className="primary wide" disabled={busy} onClick={signInGoogle}>
      <span aria-hidden="true" className="googleMark">G</span>{busy?"Opening Google…":"Sign in with Google"}
    </button>}

    {githubRequired && <button className="primary wide" disabled={busy} onClick={connectGitHub}>
      <Github size={19}/>{busy?"Opening GitHub…":"Connect GitHub"}
    </button>}

    {githubRequired && <button className="ghost wide loginSignout" disabled={busy} onClick={signOut}><LogOut size={17}/>Sign out</button>}
    {error && <p className="error" role="alert">{error}</p>}
    <small>{githubRequired
      ? "GitHub is the repository connection. You authorize the GitHub permissions shown by GitHub, and WyteLab uses them only for actions you request."
      : "Google signs you into your WyteLab account. GitHub is then connected separately for repository access. WyteLab does not host your repositories."}</small>
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
