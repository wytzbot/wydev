import {Github, Globe2, LogOut} from "lucide-react";
import {useState} from "react";
import {isNativeApp} from "../mobileBridge";
import {toastError} from "../toast";
import {github} from "../github";

export default function Login({githubRequired=false}){
  const [busy,setBusy]=useState(false);
  const googleError=new URLSearchParams(window.location.search).get("reason");
  const googleMessages={GOOGLE_NATIVE_STATE_INVALID:"Google sign-in could not be verified. Please try again.",GOOGLE_NATIVE_TOKEN_INVALID:"Google did not return a valid sign-in token.",GOOGLE_NATIVE_AUDIENCE_INVALID:"This app's Google sign-in configuration is incomplete. Please contact the developer.",GOOGLE_EMAIL_NOT_VERIFIED:"Your Google account email must be verified.",GOOGLE_NATIVE_LOGIN_FAILED:"Google sign-in failed. Please try again.",GOOGLE_STATE_MISSING:"Google sign-in session was lost. Please try again.",GOOGLE_STATE_EXPIRED:"That Google sign-in link expired or was already used. Please try again.",GOOGLE_LOGIN_CODE_MISSING:"Google did not return a sign-in code. Please try again.",GOOGLE_LOGIN_TOKEN_FAILED:"Google sign-in could not be completed. Please try again.",GOOGLE_PROFILE_FAILED:"Could not read your Google profile. Please try again.",GOOGLE_LOGIN_UNEXPECTED_ERROR:"Something went wrong finishing Google sign-in. Please try again.",GOOGLE_DRIVE_UNEXPECTED_ERROR:"Something went wrong connecting Google Drive. Please try again.",SERVER_ERROR:"Something went wrong. Please try again."};
  const googleSignIn=async()=>{setBusy(true);try{await github.googleLogin();}catch(e){setBusy(false);toastError(e?.message||"Google sign-in could not start.");}};
  return <main className="login"><div className="loginBox">
    <div className="brand">WyteLab</div>
    <h1>{githubRequired?"Connect GitHub to continue.":"Code on the move."}</h1>
    <p>{githubRequired?"Your Google account is signed in. Connect GitHub so WyteLab can access the repositories you choose.":"Edit, organize, diagnose and push GitHub projects from your phone."}</p>
    {githubRequired ? (
      <button className="primary wide" onClick={github.connectGitHub}><Github size={19}/>Connect GitHub</button>
    ) : <>
      <button className="primary wide" disabled={busy} onClick={googleSignIn}><Globe2 size={19}/>{busy?"Opening Google…":"Continue with Google"}</button>
      <button className="secondary wide" onClick={github.login}><Github size={19}/>Continue with GitHub</button>
    </>}
    {githubRequired && <button className="ghost wide loginSignout" onClick={async()=>{await github.logout().catch(()=>{});location.reload();}}><LogOut size={17}/>Sign out</button>}
    {googleError && <p className="error">{googleMessages[googleError]||"Google sign-in could not be completed. Please try again."}</p>}
    {isNativeApp() && !githubRequired && <small>Google sign-in uses the app's native Google login when available. Enable Median Social Login → Google in the APK build.</small>}
    {!isNativeApp() && <small>{githubRequired?"Google SSO creates the WyteLab account session; GitHub remains the source of truth for repository access.":"You can use Google SSO for your WyteLab account, then connect GitHub for repository access. WyteLab does not host your repositories."}</small>}
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
