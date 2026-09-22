import {Github, LogOut} from "lucide-react";
import {useState} from "react";
import {toastError} from "../toast";
import {github} from "../github";

function authMessage(error){
  const code=String(error?.code||"");
  const messages={
    "GITHUB_REQUIRED":"Connect your GitHub account to continue.",
    "OAUTH_STATE_MISSING":"The GitHub sign-in session expired. Start again.",
    "OAUTH_PROVIDER_MISMATCH":"The GitHub authorization could not be verified. Start again.",
    "SESSION_EXPIRED":"Your sign-in session expired. Start again.",
    "GITHUB_TOKEN_EXCHANGE_FAILED":"GitHub authorization could not be completed. Please try again.",
    "NETWORK_ERROR":"Could not reach GitHub. Check your connection and try again."
  };
  return messages[code] || error?.message || "GitHub connection could not be completed. Please try again.";
}

export default function Login({githubRequired=false}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const connectGitHub=()=>{
    setBusy(true);
    setError("");
    try{
      // GitHub is the only account sign-in path. The OAuth redirect is handled
      // by the server so Android WebView builds do not depend on Firebase
      // redirect storage/sessionStorage to start or finish authentication.
      github.login();
    }catch(e){
      setBusy(false);
      const message=authMessage(e);
      setError(message);
      toastError(message);
    }
  };

  const signOut=async()=>{
    setBusy(true);
    try{await github.logout();}catch{}
    window.location.replace("/");
  };

  return <main className="login"><div className="loginBox">
    <div className="brand">WyteLab</div>
    <h1>{githubRequired?"Connect GitHub to continue.":"Connect GitHub to get started."}</h1>
    <p>{githubRequired
      ? "Reconnect your GitHub account so WyteLab can access the repositories you choose."
      : "Edit, organize, diagnose and push GitHub projects from your browser or Android app."}</p>
    <button className="primary wide" disabled={busy} onClick={connectGitHub}>
      <Github size={19}/>{busy?"Opening GitHub…":"Connect GitHub"}
    </button>
    {githubRequired && <button className="ghost wide loginSignout" disabled={busy} onClick={signOut}><LogOut size={17}/>Sign out</button>}
    {error && <p className="error">{error}</p>}
    <small>GitHub is the account and repository connection for WyteLab. You authorize the GitHub permissions shown by GitHub, and WyteLab uses them only for actions you request. WyteLab does not host your repositories.</small>
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
