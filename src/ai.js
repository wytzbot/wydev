import {API_BASE_URL} from "./config";

async function postAI(path,payload,signal){
  const r=await fetch(`${API_BASE_URL}${path}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const error=new Error(data.error||"AI diagnosis failed");
    error.code=data.code||"AI_ERROR";
    error.limit=data.limit;
    error.used=data.used;
    error.remaining=data.remaining;
    error.plan=data.plan;
    throw error;
  }
  return data;
}

export async function diagnose(payload, signal){
  return postAI("/ai/diagnose",payload,signal);
}

// Whole-repository diagnosis: payload = { repo, branch, files: [{path, content}] }
export async function diagnoseRepo(payload, signal){
  return postAI("/ai/diagnose-repo",payload,signal);
}
