import {API_BASE_URL} from "./config";
const api=async(path,opts={})=>{const r=await fetch(`${API_BASE_URL}${path}`,{credentials:"include",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});if(!r.ok){let e;try{e=await r.json()}catch{}throw new Error(e?.error||`Request failed (${r.status})`)}return r.json()};
export const github={
 session:()=>api("/auth/me"),login:()=>location.href=`${API_BASE_URL}/auth/github`,logout:()=>api("/auth/logout",{method:"POST"}),
 repos:()=>api("/github/repos"),
 tree:(o,r,b)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/tree?branch=${encodeURIComponent(b)}`),
 file:(o,r,p,b)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/file?path=${encodeURIComponent(p)}&branch=${encodeURIComponent(b)}`),
 branches:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/branches`),createBranch:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/branches`,{method:"POST",body:JSON.stringify(p)}),
 commit:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/commit`,{method:"POST",body:JSON.stringify(p)})
};
export function githubErrorMessage(status,body=""){
  if(status===401) return "GitHub authentication expired. Sign in again.";
  if(status===403) return "GitHub denied the request. Check repository permissions or rate limits.";
  if(status===404) return "GitHub could not find that repository or file, or you do not have access.";
  if(status===409) return "GitHub reported a conflict. Pull latest changes and review them.";
  if(status===422) return "GitHub rejected the request. Check the branch, path, or commit data.";
  return body ? `GitHub request failed (${status}): ${body}` : `GitHub request failed (${status}).`;
}
