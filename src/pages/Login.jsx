import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import { github } from "../github";
import { finishGoogleSignIn, startGoogleSignIn } from "../firebase-auth";

export default function Login(){
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const result=await finishGoogleSignIn();
        if(!active || !result?.user) return;
        setBusy("google");
        const idToken=await result.user.getIdToken(true);
        const response=await github.firebaseLogin(idToken);
        if(!response?.user) throw new Error("Google sign-in could not create a WyteLab session.");
        window.location.replace("/");
      }catch(e){
        if(active){ setBusy(""); setError(e?.message||"Google sign-in failed. Please try again."); }
      }
    })();
    return()=>{active=false};
  },[]);

  const google=async()=>{
    setError("");setBusy("google");
    try{await startGoogleSignIn();}
    catch(e){setBusy("");setError(e?.message||"Google sign-in could not start.");}
  };

  const githubLogin=()=>{setError("");setBusy("github");github.login();};

  return <main className="login"><div className="loginBox"><div className="brand">WyteLab</div><h1>Code on the move.</h1><p>Edit, organize, diagnose and push GitHub projects from your phone.</p>
    <button className="primary wide" onClick={google} disabled={!!busy}><span className="googleMark">G</span>{busy==="google"?"Connecting to Google…":"Continue with Google"}</button>
    <button className="secondary wide" onClick={githubLogin} disabled={!!busy}><Github size={19}/>{busy==="github"?"Opening GitHub…":"Continue with GitHub"}</button>
    {error&&<p className="error loginError">{error}</p>}
    <small>Google signs you into your WyteLab account. GitHub connects the repository workspace and remains the source of truth for your code.</small>
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
