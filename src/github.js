import {API_BASE_URL} from "./config";
import {fetchTimeout} from "./net";
const api=async(path,opts={})=>{let r;try{r=await fetchTimeout(`${API_BASE_URL}${path}`,{credentials:"include",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts})}catch(e){throw new Error(/timed out/i.test(e?.message||"")?"WyteLab took too long to respond. Check your connection and retry.":`Could not reach WyteLab. Check your internet connection and retry. (${e?.message||"network error"})`)}let e=null;try{e=await r.json()}catch{}if(!r.ok){const fallbacks={400:"WyteLab could not understand that request. Check the supplied details and try again.",401:"Your login session has expired or GitHub authorization is no longer valid. Sign in again to continue.",403:"WyteLab or GitHub denied this action. Check your plan and repository permissions.",404:"The requested repository, file, or feature could not be found. Refresh and try again.",409:"The repository changed while this action was running. Reload the repository and retry.",413:"This upload is too large. Use a smaller ZIP or split the files.",422:"The request was understood but the supplied data could not be processed. Check the file, branch, or configuration.",429:"Too many requests. Wait a little and try again.",500:"WyteLab encountered an unexpected server error. Retry; if it continues, contact support.",503:"This feature is temporarily unavailable because a required server service is not configured or is offline."};const err=new Error(e?.error||fallbacks[r.status]||`WyteLab request failed (HTTP ${r.status}).`);err.status=r.status;err.code=e?.code;err.details=e;throw err}return e};
export const github={
 session:()=>api("/auth/me"),previewUsage:(repo,consume=false)=>consume?api("/preview/usage",{method:"POST",body:JSON.stringify({repo})}):api(`/preview/usage?repo=${encodeURIComponent(repo)}`),login:(fresh=false,account="")=>{const q=new URLSearchParams();if(fresh)q.set("fresh","1");if(account)q.set("login",account);location.href=`${API_BASE_URL}/auth/github${q.size?`?${q.toString()}`:""}`;},logout:async()=>{const r=await api("/auth/logout",{method:"POST"});try{sessionStorage.setItem("wydev:githubFreshLogin","1")}catch{}return r;},
 firebaseLogin:(idToken)=>api("/auth/firebase",{method:"POST",body:JSON.stringify({idToken})}),
 repos:()=>api("/github/repos"),
 createRepo:(p)=>api("/github/repos",{method:"POST",body:JSON.stringify(p)}),
 deleteRepo:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`,{method:"DELETE"}),
 tree:(o,r,b)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/tree?branch=${encodeURIComponent(b)}`),
 file:(o,r,p,b)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/file?path=${encodeURIComponent(p)}&branch=${encodeURIComponent(b)}`),
 branches:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/branches`),
 createBranch:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/branches`,{method:"POST",body:JSON.stringify(p)}),
 pulls:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/pulls`),
 createPull:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/pulls`,{method:"POST",body:JSON.stringify(p)}),
 blob:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/blob`,{method:"POST",body:JSON.stringify(p)}),
 commit:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/commit`,{method:"POST",body:JSON.stringify(p)}),
 commits:(o,r,branch,limit=10)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/commits?branch=${encodeURIComponent(branch)}&limit=${encodeURIComponent(limit)}`),
 revert:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/revert`,{method:"POST",body:JSON.stringify(p)}),
 actionsRuns:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/runs`),
 actionsJobs:(o,r,id)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/runs/${encodeURIComponent(id)}/jobs`),
 rerunFailed:(o,r,id,p={})=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/runs/${encodeURIComponent(id)}/rerun-failed`,{method:"POST",body:JSON.stringify(p)}),
 cancelRun:(o,r,id,force=false)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/runs/${encodeURIComponent(id)}/${force?"force-cancel":"cancel"}`,{method:"POST"}),
 workflows:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/workflows`),
 dispatchWorkflow:(o,r,id,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/workflows/${encodeURIComponent(id)}/dispatch`,{method:"POST",body:JSON.stringify(p)}),
 licenseTemplate:(key)=>api(`/github/licenses/${encodeURIComponent(key)}`),
 issues:(o,r,state="open")=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues?state=${encodeURIComponent(state)}`),
 createIssue:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues`,{method:"POST",body:JSON.stringify(p)}),
 releases:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/releases`),
 createRelease:(o,r,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/releases`,{method:"POST",body:JSON.stringify(p)}),
 compare:(o,r,b,h)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/compare?base=${encodeURIComponent(b)}&head=${encodeURIComponent(h)}`),
 pullList:(o,r,state="open")=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/pulls?state=${encodeURIComponent(state)}`),
 mergePull:(o,r,n,p)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/pulls`,{method:"POST",body:JSON.stringify({number:n,...p})}),
 starStatus:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/star`),
 star:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/star`,{method:"PUT"}),
 unstar:(o,r)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/star`,{method:"DELETE"}),
 fork:(o,r,name)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/fork`,{method:"POST",body:JSON.stringify({name})}),
 driveExport:(o,r,b)=>api(`/github/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/drive-export`,{method:"POST",body:JSON.stringify({branch:b})}),
 googleDriveStatus:()=>api("/auth/google/status"),
 googleDriveDisconnect:()=>api("/auth/google/disconnect",{method:"POST"})
};
export function githubErrorMessage(status,body=""){
  if(status===401) return "Your login session has expired or GitHub authorization is no longer valid. Sign in again to continue.";
  if(status===403) return "GitHub denied the request. Check repository permissions or rate limits.";
  if(status===404) return "GitHub could not find that repository or file, or you do not have access.";
  if(status===409) return "GitHub reported a conflict. Pull latest changes and review them.";
  if(status===422) return "GitHub rejected the request. Check the branch, path, or commit data.";
  return body ? `GitHub request failed (${status}): ${body}` : `GitHub request failed (${status}).`;
}
