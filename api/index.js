import crypto from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
let db=null;
try{
  const admin=require("firebase-admin");
  if(!admin.apps.length && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY){
    admin.initializeApp({credential:admin.credential.cert({
      projectId:process.env.FIREBASE_PROJECT_ID,
      clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")
    })});
  }
  if(admin.apps.length) db=admin.firestore();
}catch(e){ console.warn("Firebase Admin unavailable; persistence disabled:",e.message); }

const GH="https://api.github.com";
const FLW_TOKEN="https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";
const FLW_BASE=process.env.FLW_ENV==="production"
  ?"https://f4bexperience.flutterwave.com"
  :"https://developersandbox-api.flutterwave.com";

const memory={usage:new Map(),entitlements:new Map(),transactions:new Map(),preferences:new Map(),cache:new Map()};
async function getEntitlement(userId){
  if(db){const d=await db.collection("wydev_entitlements").doc(String(userId)).get();return d.exists?d.data():null}
  return memory.entitlements.get(String(userId))||null;
}
async function setEntitlement(userId,data){
  if(db){await db.collection("wydev_entitlements").doc(String(userId)).set(data,{merge:true});return}
  memory.entitlements.set(String(userId),data);
}
async function getUsage(userId,day){
  if(db){const d=await db.collection("wydev_ai_usage").doc(`${userId}_${day}`).get();return d.exists?(d.data().count||0):0}
  return memory.usage.get(`${userId}:${day}`)||0;
}
async function incrementUsage(userId,day){
  if(db){const ref=db.collection("wydev_ai_usage").doc(`${userId}_${day}`);await db.runTransaction(async tx=>{const d=await tx.get(ref);tx.set(ref,{count:(d.exists?(d.data().count||0):0)+1,updatedAt:Date.now()},{merge:true})});return}
  const k=`${userId}:${day}`;memory.usage.set(k,(memory.usage.get(k)||0)+1);
}
async function setTransaction(reference,data){
  if(db){await db.collection("wydev_transactions").doc(reference).set(data,{merge:true});return}
  memory.transactions.set(reference,data);
}
async function getTransaction(reference){
  if(db){const d=await db.collection("wydev_transactions").doc(reference).get();return d.exists?d.data():null}
  return memory.transactions.get(reference)||null;
}


async function listDueEntitlements(){
  if(!db)return [];
  const snap=await db.collection("wydev_entitlements").where("status","==","active").where("renewAt","<=",Date.now()).limit(20).get();
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

function json(res,status,data){res.statusCode=status;res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));}
function redirect(res,url){res.statusCode=302;res.setHeader("Location",url);res.end();}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));}
async function body(req){if(req._body)return req._body;let s="";for await(const c of req)s+=c;try{return req._body=s?JSON.parse(s):{}}catch{return {}}}
function b64(v){return Buffer.from(v).toString("base64url");}
function unb64(v){return Buffer.from(v,"base64url").toString();}
function secret(){if(!process.env.SESSION_SECRET)throw new Error("SESSION_SECRET is not configured");return crypto.createHash("sha256").update(process.env.SESSION_SECRET).digest();}
function seal(obj){const iv=crypto.randomBytes(12),key=secret(),c=crypto.createCipheriv("aes-256-gcm",key,iv);const enc=Buffer.concat([c.update(JSON.stringify(obj),"utf8"),c.final()]);return [b64(iv),b64(enc),b64(c.getAuthTag())].join(".");}
function openCookie(v){try{const [iv,enc,tag]=v.split(".");const d=crypto.createDecipheriv("aes-256-gcm",secret(),Buffer.from(iv,"base64url"));d.setAuthTag(Buffer.from(tag,"base64url"));return JSON.parse(Buffer.concat([d.update(Buffer.from(enc,"base64url")),d.final()]).toString())}catch{return null}}
function setSession(res,user){const value=seal(user);res.setHeader("Set-Cookie",`wydev_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);}
function clearSession(res){res.setHeader("Set-Cookie","wydev_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");}
function session(req){const c=parseCookies(req).wydev_session;return c?openCookie(c):null;}
function requireSession(req,res){const s=session(req);if(!s?.token||!s?.login){json(res,401,{error:"GitHub authentication required"});return null}return s;}
function ghHeaders(token){return{"Authorization":`Bearer ${token}`,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"WyDev-Mobile-Editor"};}
async function gh(token,path,opts={}){const r=await fetch(GH+path,{...opts,headers:{...ghHeaders(token),...(opts.headers||{})}});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={message:text}}if(!r.ok)throw Object.assign(new Error(data.message||`GitHub request failed (${r.status})`),{status:r.status,data});return data;}

function origin(req){const proto=(req.headers["x-forwarded-proto"]||"https").split(",")[0];const host=req.headers["x-forwarded-host"]||req.headers.host;return `${proto}://${host}`;}
function oauthStart(req,res){const state=b64(crypto.randomBytes(24));const redirectUri=process.env.GITHUB_REDIRECT_URI||`${origin(req)}/api/auth/github/callback`;const url=new URL("https://github.com/login/oauth/authorize");url.searchParams.set("client_id",process.env.GITHUB_CLIENT_ID||"");url.searchParams.set("redirect_uri",redirectUri);url.searchParams.set("scope","read:user repo");url.searchParams.set("state",state);res.setHeader("Set-Cookie",`wydev_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);redirect(res,url.toString());}
async function oauthCallback(req,res){const q=new URL(req.url,origin(req)).searchParams;const state=q.get("state"),code=q.get("code");const cookies=parseCookies(req);if(!state||state!==cookies.wydev_oauth_state)return json(res,400,{error:"Invalid OAuth state"});if(!code)return json(res,400,{error:"GitHub did not return an authorization code"});const redirectUri=process.env.GITHUB_REDIRECT_URI||`${origin(req)}/api/auth/github/callback`;const r=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code,redirect_uri:redirectUri})});const token=await r.json();if(!r.ok||!token.access_token)return json(res,502,{error:"GitHub token exchange failed"});const me=await gh(token.access_token,"/user");setSession(res,{token:token.access_token,refresh_token:token.refresh_token||null,login:me.login,id:me.id,name:me.name,avatar:me.avatar_url,scope:token.scope});res.setHeader("Set-Cookie",[res.getHeader("Set-Cookie"),"wydev_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"].filter(Boolean));redirect(res,"/");}

function limitKey(s){return `${s.id||s.login}:${new Date().toISOString().slice(0,10)}`;}
async function entitlement(s){const e=await getEntitlement(s.id);return e?.status==="active"&&(!e.expiresAt||e.expiresAt>Date.now())?"pro":"free";}
async function checkAIQuota(s){const day=new Date().toISOString().slice(0,10),used=await getUsage(s.id,day),plan=await entitlement(s),limit=plan==="pro"?Number(process.env.AI_PRO_DAILY_LIMIT||20):Number(process.env.AI_FREE_DAILY_LIMIT||5);if(used>=limit)throw Object.assign(new Error(`Daily AI diagnostic limit reached (${limit}). Try again tomorrow.`),{status:429,code:"AI_QUOTA_EXCEEDED",limit,used,plan});return {day,plan,limit,used};}
function redactSecrets(value){let s=String(value||"");return s
 .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/gi,"[REDACTED_PRIVATE_KEY]")
 .replace(/(ghp_|github_pat_|sk-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]{20,})[A-Za-z0-9_-]*/g,"[REDACTED_TOKEN]")
 .replace(/(api[_-]?key|secret|password|token|authorization)\s*[:=]\s*["']?[^\s"',}]+/gi,"$1=[REDACTED]");return s;}
function parseGeminiText(data){return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";}
async function geminiDiagnose(prompt,schema){
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("GEMINI_API_KEY is not configured");
  const model=process.env.GEMINI_MODEL||"gemini-2.5-flash-lite";
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.1,maxOutputTokens:900,responseMimeType:"application/json",responseSchema:schema}})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data?.error?.message||`Gemini request failed (${r.status})`),{status:r.status,provider:"gemini"});
  const text=parseGeminiText(data);if(!text)throw new Error("Gemini returned an empty diagnostic");
  let out;try{out=JSON.parse(text)}catch{throw new Error("Gemini returned invalid diagnostic JSON")}
  if(!out.root_cause||!Array.isArray(out.affected_files)||!Array.isArray(out.evidence))throw new Error("AI response validation failed");
  return out;
}
async function aiDiagnose(s,payload){
  const quota=await checkAIQuota(s);
  const files=Array.isArray(payload.relatedFiles)?payload.relatedFiles.slice(0,8):[];
  const context=JSON.stringify({error:redactSecrets(payload.error),logs:redactSecrets(String(payload.logs||"").slice(0,12000)),file:redactSecrets(payload.file),content:redactSecrets(String(payload.content||"").slice(0,24000)),relatedFiles:files.map(x=>({path:redactSecrets(x.path),content:redactSecrets(String(x.content||"").slice(0,10000))})),package:redactSecrets(payload.package)});
  const schema={type:"object",properties:{title:{type:"string"},severity:{type:"string"},root_cause:{type:"string"},affected_files:{type:"array",items:{type:"string"}},affected_lines:{type:"array",items:{type:"string"}},evidence:{type:"array",items:{type:"string"}},likely_reason:{type:"string"},recommended_action:{type:"string"},confidence:{type:"number"}},required:["title","severity","root_cause","affected_files","affected_lines","evidence","likely_reason","recommended_action","confidence"]};
  const prompt=`You are WyDev Diagnostic Engine. Diagnose only. NEVER edit code, generate patches, replace files, commit, push, rename files, or perform autonomous actions. Identify the exact problem from the supplied minimum context. If evidence is insufficient, say so. Return only valid JSON matching the supplied schema. Keep the diagnosis concise and developer-readable.\nCONTEXT:\n${context}`;
  const out=await geminiDiagnose(prompt,schema);
  await incrementUsage(s.id,quota.day);
  return {...out,usage:{used:quota.used+1,limit:quota.limit,remaining:Math.max(0,quota.limit-quota.used-1),plan:quota.plan}};
}

async function flwToken(){const r=await fetch(FLW_TOKEN,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.FLW_CLIENT_ID||"",client_secret:process.env.FLW_CLIENT_SECRET||"",grant_type:"client_credentials"})});const d=await r.json();if(!r.ok||!d.access_token)throw new Error(d.error_description||"Flutterwave authentication failed");return d.access_token;}
async function flw(path,opts={}){const token=await flwToken();const trace=crypto.randomUUID();const r=await fetch(FLW_BASE+path,{...opts,headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","X-Trace-Id":trace,"X-Idempotency-Key":crypto.randomUUID(),...(opts.headers||{})}});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={message:t}}if(!r.ok)throw Object.assign(new Error(d.message||"Flutterwave request failed"),{status:r.status,data:d});return d;}
function amountFor(currency){if(currency==="NGN"){const n=Number(process.env.FLW_PRO_NGN||9000);if(!n)throw new Error("FLW_PRO_NGN is required for NGN checkout");return n}return Number(process.env.FLW_PRO_USD||9.99);}

async function createBillingCheckout(s,payload){
  const currency=payload.currency==="NGN"?"NGN":"USD", amount=amountFor(currency), reference=`WYDEV-PRO-${s.id}-${crypto.randomUUID()}`;
  const customerPayload={email:payload.email||`${s.login}@users.noreply.github.com`,name:{first:s.name||s.login},meta:{github_id:String(s.id)}};
  if(payload.payment_method?.type!=="card")throw new Error("Select card checkout.");
  const customer=await flw("/customers",{method:"POST",body:JSON.stringify(customerPayload)});
  const customerId=customer.data?.id;
  if(!customerId)throw new Error("Flutterwave did not return a customer id");
  const pm=await flw("/payment-methods",{method:"POST",body:JSON.stringify({type:"card",card:payload.payment_method.card})});
  const paymentMethodId=pm.data?.id;
  if(!paymentMethodId)throw new Error("Flutterwave did not return a payment method id");
  const charge=await flw("/charges",{method:"POST",body:JSON.stringify({amount,currency,reference,customer_id:customerId,payment_method_id:paymentMethodId,redirect_url:`${origin(payload.req)}/?billing=return&tx_ref=${encodeURIComponent(reference)}`,recurring:false})});
  await setTransaction(reference,{userId:String(s.id),amount,currency,status:charge.data?.status||"pending",chargeId:charge.data?.id,customerId,paymentMethodId,createdAt:Date.now()});
  return charge;
}
async function authorizeCharge(s,id,authorization){
  if(!id||!authorization?.type)throw Object.assign(new Error("Charge id and authorization are required"),{status:400});
  const d=await flw(`/charges/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify({authorization})});
  return d;
}
async function renewDue(){
  const due=await listDueEntitlements(); let processed=0;
  for(const e of due){
    if(!e.customerId||!e.paymentMethodId||!e.currency)continue;
    try{
      const reference=`WYDEV-RENEW-${e.id}-${crypto.randomUUID()}`,amount=amountFor(e.currency);
      const d=await flw("/charges",{method:"POST",body:JSON.stringify({reference,currency:e.currency,amount,customer_id:e.customerId,payment_method_id:e.paymentMethodId,recurring:true})});
      const status=d.data?.status||"pending"; await setTransaction(reference,{userId:e.id,amount,currency:e.currency,status,chargeId:d.data?.id,customerId:e.customerId,paymentMethodId:e.paymentMethodId,createdAt:Date.now(),renewal:true});
      if(status==="succeeded")await setEntitlement(e.id,{status:"active",expiresAt:Date.now()+31*86400000,renewAt:Date.now()+31*86400000,updatedAt:Date.now(),lastRenewalReference:reference});
      else await setEntitlement(e.id,{status:"past_due",updatedAt:Date.now(),lastRenewalReference:reference});
      processed++;
    }catch{await setEntitlement(e.id,{status:"past_due",updatedAt:Date.now()});}
  }
  return processed;
}
async function verifyCharge(s,id,reference){const d=await flw(`/charges/${encodeURIComponent(id)}`);const x=d.data||{};const expected=await getTransaction(reference);if(!expected||String(expected.userId)!==String(s.id))throw new Error("Transaction does not belong to this account");if(x.status==="succeeded"&&Number(x.amount)===Number(expected.amount)&&x.currency===expected.currency){await setEntitlement(s.id,{status:"active",expiresAt:Date.now()+31*86400000,renewAt:Date.now()+31*86400000,reference,customerId:expected.customerId,paymentMethodId:expected.paymentMethodId,currency:expected.currency,updatedAt:Date.now()});return {active:true,status:x.status}}return {active:false,status:x.status||"pending"};}
function validWebhook(req,raw){const sig=req.headers["flutterwave-signature"];if(!sig||!process.env.FLW_WEBHOOK_SECRET_HASH)return false;const h=crypto.createHmac("sha256",process.env.FLW_WEBHOOK_SECRET_HASH).update(raw).digest("base64");const a=Buffer.from(h),b=Buffer.from(String(sig));return a.length===b.length&&crypto.timingSafeEqual(a,b);}

async function handler(req,res){
  try{
    const url=new URL(req.url,origin(req)),p=url.pathname.replace(/^\/api/,"")||"/";
    if(p==="/auth/github"&&req.method==="GET")return oauthStart(req,res);
    if(p==="/auth/github/callback"&&req.method==="GET")return oauthCallback(req,res);
    if(p==="/auth/me"&&req.method==="GET"){const s=session(req);return json(res,200,s?{user:{id:s.id,login:s.login,name:s.name,avatar:s.avatar}}:{user:null});}
    if(p==="/auth/logout"&&req.method==="POST"){clearSession(res);return json(res,200,{ok:true});}
    const s=requireSession(req,res);if(!s)return;
    if(p==="/preferences"&&req.method==="GET") {
      const ref=db?.collection("wydev_preferences").doc(String(s.id));
      if(!ref) return json(res,200,{preferences:memory.preferences.get(String(s.id))||{}});
      const d=await ref.get();
      return json(res,200,{preferences:d.exists?(d.data().preferences||{}):{}});
    }
    if(p==="/preferences"&&req.method==="PUT") {
      const b=await body(req), incoming=b?.preferences&&typeof b.preferences==="object"?b.preferences:{};
      const allowed=["fontSize","wordWrap","reducedMotion","density"];
      const preferences={};
      for(const k of allowed) if(Object.prototype.hasOwnProperty.call(incoming,k)) preferences[k]=incoming[k];
      if(db) await db.collection("wydev_preferences").doc(String(s.id)).set({preferences,updatedAt:Date.now()},{merge:true});
      else memory.preferences.set(String(s.id),preferences);
      return json(res,200,{ok:true,preferences});
    }
    if(p==="/billing/webhook"&&req.method==="POST"){let raw="";for await(const c of req)raw+=c;if(!validWebhook(req,raw))return json(res,401,{error:"Invalid Flutterwave signature"});let data;try{data=JSON.parse(raw)}catch{return json(res,400,{error:"Invalid JSON"})}const tx=data.data||{};if(tx.id){try{const d=await flw(`/charges/${encodeURIComponent(tx.id)}`),x=d.data||{};const ref=x.reference||tx.reference,rec=await getTransaction(ref);if(rec&&x.status==="succeeded"&&Number(x.amount)===Number(rec.amount)&&x.currency===rec.currency){await setEntitlement(rec.userId,{status:"active",expiresAt:Date.now()+31*86400000,renewAt:Date.now()+31*86400000,reference:ref,customerId:rec.customerId,paymentMethodId:rec.paymentMethodId,currency:rec.currency,updatedAt:Date.now()})}}catch{} }return json(res,200,{received:true});}
    if(p==="/billing/renew"&&req.method==="POST"){const auth=req.headers.authorization||"";if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`)return json(res,401,{error:"Unauthorized"});return json(res,200,{processed:await renewDue()});}
    if(p==="/billing/authorize"&&req.method==="POST"){const s=requireSession(req,res);if(!s)return;const b=await body(req);return json(res,200,await authorizeCharge(s,b.id,b.authorization));}
    if(p==="/github/repos"&&req.method==="GET"){
      const all=await gh(s.token,"/user/repos?per_page=100&sort=updated");
      const plan=await entitlement(s);
      const limit=plan==="pro"?null:Number(process.env.FREE_REPO_LIMIT||10);
      const repos=limit!=null?all.slice(0,limit):all;
      return json(res,200,{repos,total:all.length,limit,plan});
    }
    if(p==="/github/repos"&&req.method==="POST"){
      const b=await body(req);
      const name=String(b.name||"").trim();
      if(!/^[A-Za-z0-9._-]{1,100}$/.test(name))return json(res,400,{error:"Repository name may only contain letters, numbers, dots, dashes and underscores."});
      const plan=await entitlement(s);
      if(plan!=="pro"){
        const limit=Number(process.env.FREE_REPO_LIMIT||10);
        const existing=await gh(s.token,"/user/repos?per_page=100");
        if(existing.length>=limit)return json(res,403,{error:`Free plan is limited to ${limit} repositories. Upgrade to WyDev Pro for unlimited repositories.`,code:"REPO_LIMIT"});
      }
      const payload={name,private:!!b.private,auto_init:true};
      if(b.description)payload.description=String(b.description).slice(0,350);
      const created=await gh(s.token,"/user/repos",{method:"POST",body:JSON.stringify(payload)});
      return json(res,201,created);
    }
    const bm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/branches$/);
    if(bm&&req.method==="POST"){const owner=decodeURIComponent(bm[1]),repo=decodeURIComponent(bm[2]),b=await body(req);const name=String(b.name||"").trim();const from=String(b.from||"").trim();if(!/^[A-Za-z0-9._\/-]{1,120}$/.test(name)||name.startsWith("-")||name.endsWith("/"))return json(res,400,{error:"Invalid branch name"});const ref=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(from)}`);const created=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,{method:"POST",body:JSON.stringify({ref:`refs/heads/${name}`,sha:ref.object.sha})});return json(res,201,{name,sha:created.object.sha});}
    // Pull requests are proxied the same way as everything else — the user's own
    // GitHub token does the work, so this costs nothing extra to run. Gated to
    // Pro as a plan perk (see checkAIQuota/entitlement for the same pattern).
    const prm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/pulls$/);
    if(prm){
      const owner=decodeURIComponent(prm[1]),repo=decodeURIComponent(prm[2]);
      const plan=await entitlement(s);
      if(plan!=="pro")return json(res,402,{error:"Pull requests are a WyDev Pro feature. Upgrade to create and manage pull requests.",code:"PRO_REQUIRED"});
      if(req.method==="GET")return json(res,200,await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&per_page=30`));
      if(req.method==="POST"){
        const b=await body(req);
        const title=String(b.title||"").trim(),head=String(b.head||"").trim(),base=String(b.base||"").trim();
        if(!title||!head||!base)return json(res,400,{error:"Title, head branch and base branch are required"});
        if(head===base)return json(res,400,{error:"Head and base branches must be different"});
        const payload={title,head,base};
        if(b.body)payload.body=String(b.body).slice(0,5000);
        const created=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,{method:"POST",body:JSON.stringify(payload)});
        return json(res,201,created);
      }
    }
    const safePath=(value)=>{const x=String(value||"").replaceAll("\\","/").replace(/^\/+/,"");const parts=x.split("/").filter(Boolean);if(!x||parts.some(v=>v===".."||v==="."))throw Object.assign(new Error("Invalid repository path."),{status:400});return parts.join("/")};
    const binaryExt=new Set(["png","jpg","jpeg","gif","webp","ico","bmp","svgz","pdf","zip","gz","tar","7z","rar","woff","woff2","ttf","otf","eot","mp3","mp4","mov","avi","webm","wav","exe","dll","so","dylib","class","jar","psd","ai","sqlite","db"]);
    const isBinaryPath=(p)=>binaryExt.has(String(p).split(".").pop()?.toLowerCase()||"");
    const mimeForPath=(p)=>({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",ico:"image/x-icon",bmp:"image/bmp",svg:"image/svg+xml",pdf:"application/pdf",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",eot:"application/vnd.ms-fontobject",mp3:"audio/mpeg",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm",wav:"audio/wav"}[String(p).split(".").pop()?.toLowerCase()||""]||"application/octet-stream");
    const m=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/(tree|file|branches)$/);
    if(m){
      const owner=decodeURIComponent(m[1]),repo=decodeURIComponent(m[2]),kind=m[3];
      if(kind==="branches")return json(res,200,await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`));
      if(kind==="file"){const path=safePath(url.searchParams.get("path")||"") ,branch=url.searchParams.get("branch")||"HEAD";const d=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`);if(Array.isArray(d))return json(res,400,{error:"The selected path is a directory, not a file."});if(isBinaryPath(path))return json(res,200,{path,content:{__wydevBinary:true,base64:String(d.content||"").replace(/\n/g,""),mime:mimeForPath(path),size:d.size||0},sha:d.sha,size:d.size});return json(res,200,{path,content:d.encoding==="base64"?Buffer.from(d.content.replace(/\n/g,""),"base64").toString("utf8"):d.content||"",sha:d.sha,size:d.size});}
      const branch=url.searchParams.get("branch")||"HEAD";const ref=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`);const commit=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${ref.object.sha}`);const tree=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${commit.tree.sha}?recursive=1`);return json(res,200,{branch,baseSha:ref.object.sha,treeSha:commit.tree.sha,files:(tree.tree||[]).filter(x=>x.type==="blob").map(x=>({path:x.path,sha:x.sha,size:x.size}))});}
    if(p==="/github/repos/commit"&&req.method==="POST"){const b=await body(req);return json(res,400,{error:"Use /github/repos/:owner/:repo/commit"});}
    const cm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/commit$/);
    if(cm&&req.method==="POST"){
      const owner=decodeURIComponent(cm[1]),repo=decodeURIComponent(cm[2]),b=await body(req),branch=b.branch,message=String(b.message||"").trim(),changes=Array.isArray(b.changes)?b.changes:[];
      if(!branch||!message||message.length>200)return json(res,400,{error:"A commit message (1-200 characters) is required"});
      if(changes.length>300)return json(res,413,{error:"Too many changed files in one push. Split the work into smaller commits."});
      for(const c of changes) safePath(c.path);
      const ref=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`);
      if(b.expectedSha&&ref.object.sha!==b.expectedSha)return json(res,409,{error:"Remote changes detected. Review the latest GitHub changes before pushing.",code:"REMOTE_CHANGED",remoteSha:ref.object.sha});
      const head=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${ref.object.sha}`);
      const entries=[];
      const uploads=[];
      for(const c of changes){
        if(!c.path) continue;
        if(c.status==="D"){entries.push({path:c.path,mode:"100644",type:"blob",sha:null});continue}
        const binary=c.content&&typeof c.content==="object"&&c.content.__wydevBinary===true;
        if(binary&&!c.content.base64)return json(res,400,{error:`Binary file ${c.path} has no data.`});
        uploads.push({c,binary});
      }
      // Create blobs concurrently. Sequential blob creation made larger ZIP
      // imports look like a dead Commit & Push button and could hit the
      // serverless timeout before GitHub ever received the commit.
      const blobResults=await Promise.all(uploads.map(async ({c,binary})=>{
        const blob=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,{method:"POST",body:JSON.stringify({content:binary?String(c.content.base64):String(c.content??""),encoding:binary?"base64":"utf-8"})});
        return {path:c.path,mode:"100644",type:"blob",sha:blob.sha};
      }));
      entries.push(...blobResults);
      const tree=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,{method:"POST",body:JSON.stringify({base_tree:head.tree.sha,tree:entries})});
      const commit=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,{method:"POST",body:JSON.stringify({message,tree:tree.sha,parents:[ref.object.sha]})});
      await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,{method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})});
      return json(res,200,{ok:true,commitSha:commit.sha,html_url:commit.html_url});
    }
    if(p==="/ai/diagnose"&&req.method==="POST"){const b=await body(req);return json(res,200,await aiDiagnose(s,b));}
    if(p==="/billing/status"&&req.method==="GET"){const e=await getEntitlement(s.id);return json(res,200,{plan:await entitlement(s),expiresAt:e?.expiresAt||null});}
    if(p==="/billing/config"&&req.method==="GET")return json(res,200,{usd:Number(process.env.FLW_PRO_USD||9.99),ngn:Number(process.env.FLW_PRO_NGN||9000),environment:process.env.FLW_ENV||"sandbox"});
    if(p==="/billing/verify"&&req.method==="POST"){const b=await body(req);if(!b.id||!b.reference)return json(res,400,{error:"Transaction id and reference required"});return json(res,200,await verifyCharge(s,b.id,b.reference));}
    if(p==="/billing/checkout"&&req.method==="POST"){const b=await body(req);b.req=req;const d=await createBillingCheckout(s,b);return json(res,200,d);}
    return json(res,404,{error:"Route not found"});
  }catch(e){return json(res,e.status||500,{error:e.message||"Server error",code:e.code,limit:e.limit,used:e.used,remaining:e.remaining,plan:e.plan});}
}
export default handler;
