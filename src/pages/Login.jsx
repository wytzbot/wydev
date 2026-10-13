import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import { github } from "../github";
import { finishGoogleSignIn, startGoogleSignIn } from "../firebase-auth";

export default function Login(){
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [accounts,setAccounts]=useState(()=>{try{return JSON.parse(localStorage.getItem("wydev:githubAccounts")||"[]").filter(a=>a&&typeof a.login==="string").slice(0,5)}catch{return []}});
  const [selectedAccount,setSelectedAccount]=useState("");
  const rememberAccount=(user)=>{if(!user?.login)return;try{const key="wydev:githubAccounts";const old=JSON.parse(localStorage.getItem(key)||"[]");const next=[{login:user.login,name:user.name||user.login,avatar:user.avatar||""},...old.filter(a=>a?.login?.toLowerCase()!==user.login.toLowerCase())].slice(0,5);localStorage.setItem(key,JSON.stringify(next));setAccounts(next);setSelectedAccount(user.login)}catch{}};

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const result=await finishGoogleSignIn();
        if(!active || !result?.user) return;
        setBusy("google");
        const idToken=await result.user.getIdToken(true);
        const response=await github.firebaseLogin(idToken);
        if(!response?.user) throw new Error("Google™ sign-in could not create a WyteLab session.");
        window.location.replace("/");
      }catch(e){
        if(active){ setBusy(""); setError(e?.message||"Google™ sign-in failed. Please try again."); }
      }
    })();
    return()=>{active=false};
  },[]);

  const google=async()=>{
    setError("");setBusy("google");
    try{await startGoogleSignIn();}
    catch(e){setBusy("");setError(e?.message||"Google™ sign-in could not start.");}
  };

  const githubLogin=(account=selectedAccount)=>{setError("");setBusy("github");let fresh=false;try{fresh=sessionStorage.getItem("wydev:githubFreshLogin")==="1";sessionStorage.removeItem("wydev:githubFreshLogin")}catch{}github.login(fresh,account||"");};

  return <main className="login"><div className="loginBox"><div className="brand">WyteLab</div><h1>Code on the move.</h1><p>Edit, organize, preview and push GitHub projects from your phone.</p>
    <button className="primary wide" onClick={google} disabled={!!busy}><span className="googleMark">G</span>{busy==="google"?"Connecting to Google™…":"Continue with Google™"}</button>
    {accounts.length>0&&<div className="accountChooser"><label htmlFor="github-account">Choose a previously used GitHub account</label><select id="github-account" value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} disabled={!!busy}><option value="">Choose account…</option>{accounts.map(a=><option key={a.login} value={a.login}>{a.name} (@{a.login})</option>)}</select><button className="secondary wide" onClick={()=>githubLogin(selectedAccount)} disabled={!!busy||!selectedAccount}><Github size={19}/>{busy==="github"?"Opening GitHub…":`Continue as @${selectedAccount||"…"}`}</button></div>}
    <button className="secondary wide" onClick={()=>githubLogin("")} disabled={!!busy}><Github size={19}/>{busy==="github"?"Opening GitHub…":"Continue with another GitHub account"}</button>
    {error&&<p className="error loginError">{error}</p>}
    <small>Google™ signs you into your WyteLab account. GitHub connects the repository workspace and remains the source of truth for your code.</small>
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
