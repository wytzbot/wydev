import {API_BASE_URL} from "./config";
export async function diagnose(payload,signal){const r=await fetch(`${API_BASE_URL}/ai/diagnose`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"AI diagnosis failed");return r.json()}
