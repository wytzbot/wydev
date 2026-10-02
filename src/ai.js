import {API_BASE_URL} from "./config";
import {fetchTimeout} from "./net";

async function postAI(path,payload,signal){
  // AI diagnosis can legitimately take a while, so this gets a longer
  // ceiling than the default — but it still needs one, otherwise a request
  // that goes out right as the app is backgrounded (a very common way to
  // trigger a diagnosis and then switch apps while waiting) can hang
  // forever on Android instead of eventually failing with a normal,
  // already-handled error.
  const r=await fetchTimeout(`${API_BASE_URL}${path}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal},60000);
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
