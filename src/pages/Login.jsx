import {Github, Globe2, LogOut} from "lucide-react";
import {github} from "../github";

export default function Login({githubRequired=false}){
  return <main className="login"><div className="loginBox">
    <div className="brand">WyteLab</div>
    <h1>{githubRequired?"Connect GitHub to continue.":"Code on the move."}</h1>
    <p>{githubRequired?"Your Google account is signed in. Connect GitHub so WyteLab can access the repositories you choose.":"Edit, organize, diagnose and push GitHub projects from your phone."}</p>
    {githubRequired ? (
      <button className="primary wide" onClick={github.connectGitHub}><Github size={19}/>Connect GitHub</button>
    ) : <>
      <button className="primary wide" onClick={github.googleLogin}><Globe2 size={19}/>Continue with Google</button>
      <button className="secondary wide" onClick={github.login}><Github size={19}/>Continue with GitHub</button>
    </>}
    {githubRequired && <button className="ghost wide loginSignout" onClick={async()=>{await github.logout().catch(()=>{});location.reload();}}><LogOut size={17}/>Sign out</button>}
    <small>{githubRequired?"Google SSO creates the WyteLab account session; GitHub remains the source of truth for repository access.":"You can use Google SSO for your WyteLab account, then connect GitHub for repository access. WyteLab does not host your repositories."}</small>
    <nav className="loginLegal"><a href="/legal/about.html">About</a><a href="/legal/privacy.html">Privacy Policy</a><a href="/legal/terms.html">Terms of Service</a><a href="/legal/contact.html">Contact</a></nav>
  </div></main>
}
