import crypto from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
let db=null;
try{
  const admin=require("firebase-admin");
  if(!admin.apps.length){
    const jsonCred=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||"").trim();
    if(jsonCred){
      const c=JSON.parse(jsonCred);
      admin.initializeApp({credential:admin.credential.cert(c)});
    }else if(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY){
      admin.initializeApp({credential:admin.credential.cert({
        projectId:process.env.FIREBASE_PROJECT_ID,
        clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")
      })});
    }
  }
  if(admin.apps.length) db=admin.firestore();
}catch(e){ console.error("Firebase Admin initialization failed:",e.message); }

async function firebaseMessaging(){
  if(!db) return null;
  try { const admin=require("firebase-admin"); return admin.messaging(); } catch { return null; }
}
const FIREBASE_WEB_CONFIG=Object.freeze({
  apiKey:"AIzaSyCqN_fapK0cvhrtQfJp6YIAefR2bfUwXeU",
  authDomain:"wydev0.firebaseapp.com",
  projectId:"wydev0",
  storageBucket:"wydev0.firebasestorage.app",
  messagingSenderId:"966164490746",
  appId:"1:966164490746:web:32e95ccb554775896ddc43",
  measurementId:"G-23WQF9RH9Y"
});
function publicFirebaseConfig(){ return FIREBASE_WEB_CONFIG; }
function tokenKey(token){return crypto.createHash("sha256").update(String(token)).digest("hex");}
async function savePushToken(user,token,timezone){
  if(!db) throw Object.assign(new Error("Push notifications require Firebase persistence to be configured."),{status:503,code:"NOTIFICATIONS_NOT_CONFIGURED"});
  const ref=db.collection("wydev_fcm_tokens").doc(tokenKey(token));
  await ref.set({userId:String(user.id),login:String(user.login||""),token:String(token),timezone:String(timezone||"UTC"),updatedAt:Date.now(),enabled:true},{merge:true});
}
async function removePushToken(user,token){if(!db||!token)return;await db.collection("wydev_fcm_tokens").doc(tokenKey(token)).delete().catch(()=>{});}
async function userTokens(userId){if(!db)return [];const snap=await db.collection("wydev_fcm_tokens").where("userId","==",String(userId)).where("enabled","==",true).limit(50).get();return snap.docs.map(d=>({id:d.id,...d.data()}));}
async function sendPushToUser(userId,title,body,data={}){
  const messaging=await firebaseMessaging(); if(!messaging)return 0;
  const rows=await userTokens(userId); let sent=0;
  for(const row of rows){
    try{await messaging.send({token:row.token,notification:{title,body},data:Object.fromEntries(Object.entries(data).map(([k,v])=>[String(k),String(v)]))});sent++;}
    catch(e){if(["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(e?.code))await db.collection("wydev_fcm_tokens").doc(row.id).delete().catch(()=>{});}
  }
  return sent;
}
async function sendPushOnce(userId,key,title,body,data={}){
  if(!db)return 0;
  const ref=db.collection("wydev_notification_log").doc(crypto.createHash("sha256").update(`${userId}:${key}`).digest("hex"));
  let claimed=false;
  try{
    claimed=await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(snap.exists)return false;
      tx.create(ref,{userId:String(userId),key,status:"sending",createdAt:Date.now()});
      return true;
    });
  }catch(e){
    if(e?.code==="already-exists"||/already exists/i.test(e?.message||""))return 0;
    throw e;
  }
  if(!claimed)return 0;
  try{
    const sent=await sendPushToUser(userId,title,body,data);
    await ref.set({status:"sent",sentAt:Date.now(),sent},{merge:true});
    return sent;
  }catch(e){
    await ref.delete().catch(()=>{});
    throw e;
  }
}

const GH="https://api.github.com";
const FLW_TOKEN="https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";
const FLW_ENV=String(process.env.FLW_ENV||"live").trim().toLowerCase();
const FLW_LIVE=/^(production|prod|live)$/i.test(FLW_ENV);
const FLW_BASE=String(process.env.FLW_BASE_URL||"").trim().replace(/\/$/,"") || (FLW_LIVE
  ?"https://f4bexperience.flutterwave.com"
  :"https://developersandbox-api.flutterwave.com");

const memory={usage:new Map(),entitlements:new Map(),transactions:new Map(),preferences:new Map(),cache:new Map(),oauthStates:new Map(),flwToken:null};
async function getEntitlement(userId){
  if(db){const d=await db.collection("wydev_entitlements").doc(String(userId)).get();return d.exists?d.data():null}
  return memory.entitlements.get(String(userId))||null;
}
async function setEntitlement(userId,data){
  if(db){await db.collection("wydev_entitlements").doc(String(userId)).set(data,{merge:true});return}
  memory.entitlements.set(String(userId),data);
}
async function getUsage(userId,day){
  if(db){const d=await db.collection("wydev_ai_usage").doc(`${userId}_${day}`).get();return d.exists?(Number(d.data().count)||0):0}
  return memory.usage.get(`${userId}:${day}`)||0;
}
async function incrementUsage(userId,day,limit){
  if(db){
    const ref=db.collection("wydev_ai_usage").doc(`${userId}_${day}`);
    return db.runTransaction(async tx=>{
      const d=await tx.get(ref);
      const count=d.exists?(Number(d.data().count)||0):0;
      if(count>=limit)throw Object.assign(new Error(`Daily AI diagnostic limit reached (${limit}). Try again tomorrow.`),{status:429,code:"AI_QUOTA_EXCEEDED",limit,used:count});
      const next=count+1;
      tx.set(ref,{count:next,updatedAt:Date.now()},{merge:true});
      return next;
    });
  }
  const k=`${userId}:${day}`,count=memory.usage.get(k)||0;
  if(count>=limit)throw Object.assign(new Error(`Daily AI diagnostic limit reached (${limit}). Try again tomorrow.`),{status:429,code:"AI_QUOTA_EXCEEDED",limit,used:count});
  const next=count+1; memory.usage.set(k,next); return next;
}
async function setTransaction(reference,data){
  if(db){await db.collection("wydev_transactions").doc(reference).set(data,{merge:true});return}
  memory.transactions.set(reference,data);
}
async function getTransaction(reference){
  if(db){const d=await db.collection("wydev_transactions").doc(reference).get();return d.exists?d.data():null}
  return memory.transactions.get(reference)||null;
}

function requirePersistence(){
  if(!db) throw Object.assign(new Error("WyteLab billing storage is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel before accepting payments."),{status:503,code:"BILLING_STORAGE_NOT_CONFIGURED"});
}
async function getRepoSnapshot(userId){
  const key=String(userId);
  if(db){const d=await db.collection("wydev_repo_cache").doc(key).get();return d.exists?(d.data()||null):null;}
  return memory.cache.get(`repos:${key}`)||null;
}
async function saveRepoSnapshot(userId,data){
  const key=String(userId);
  const snapshot={repos:Array.isArray(data?.repos)?data.repos:[],total:Number(data?.total)||0,limit:data?.limit??null,plan:String(data?.plan||"free"),savedAt:Date.now()};
  if(db){await db.collection("wydev_repo_cache").doc(key).set(snapshot,{merge:true});return snapshot;}
  memory.cache.set(`repos:${key}`,snapshot);return snapshot;
}

async function getRepoCreateOperation(userId,operationId){
  const key=String(operationId||""); if(!key)return null;
  if(db){const d=await db.collection("wydev_repo_create_ops").doc(key).get();return d.exists?d.data():null;}
  return memory.cache.get(`repo-create:${String(userId)}:${key}`)||null;
}
async function saveRepoCreateOperation(userId,operationId,data){
  const key=String(operationId||""); if(!key)return;
  const value={...data,userId:String(userId),operationId:key,updatedAt:Date.now()};
  if(db){await db.collection("wydev_repo_create_ops").doc(key).set(value,{merge:true});return value;}
  memory.cache.set(`repo-create:${String(userId)}:${key}`,value);return value;
}

async function findRecentTransactions(userId){
  if(!db)return [];
  const snap=await db.collection("wydev_transactions").where("userId","==",String(userId)).limit(25).get();
  return snap.docs.map(d=>({reference:d.id,...d.data()})).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
}


async function listDueEntitlements(){
  if(!db)return [];
  const out=[];
  let cursor=null;
  // Process in pages so a busy day does not strand accounts after the first 20.
  // Keep the page size bounded for Vercel's execution-time limit.
  for(let page=0;page<20;page++){
    let q=db.collection("wydev_entitlements")
      .where("status","==","active")
      .limit(100);
    if(cursor)q=q.startAfter(cursor);
    const snap=await q.get();
    if(snap.empty)break;
    out.push(...snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>Number(x.renewAt||0)<=Date.now()).sort((a,b)=>Number(a.renewAt||0)-Number(b.renewAt||0)));
    cursor=snap.docs[snap.docs.length-1];
    if(snap.size<100)break;
  }
  return out;
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
function requireSession(req,res){const s=session(req);if(!s?.token||!s?.login){json(res,401,{error:"GitHub authentication required",code:"GITHUB_REQUIRED"});return null}return s;}
function reviewerList(name){return String(process.env[name]||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);}
function hasReviewerProAccess(s){
  if(String(process.env.REVIEWER_PRO_ACCESS||"").toLowerCase()!=="true")return false;
  const emails=reviewerList("REVIEWER_EMAILS"),logins=reviewerList("REVIEWER_GITHUB_LOGINS");
  const email=String(s?.email||"").trim().toLowerCase(),login=String(s?.login||"").trim().toLowerCase();
  return (email&&s?.emailVerified!==false&&emails.includes(email))||(login&&logins.includes(login));
}
function ghHeaders(token){return{"Authorization":`Bearer ${token}`,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"WyteLab-Mobile-Editor"};}
async function gh(token,path,opts={}){
  const controller=new AbortController();
  const timeoutMs=Math.max(5000,Number(opts.timeoutMs)||45000);
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const callerSignal=opts.signal;
  const abortCaller=()=>controller.abort();
  if(callerSignal){
    if(callerSignal.aborted)controller.abort();
    else callerSignal.addEventListener("abort",abortCaller,{once:true});
  }
  const fetchOpts={...opts}; delete fetchOpts.timeoutMs;
  try{
    const r=await fetch(GH+path,{...fetchOpts,signal:controller.signal,headers:{...ghHeaders(token),...(opts.headers||{})}});
    const text=await r.text(); let data;
    try{data=JSON.parse(text)}catch{data={message:text}}
    if(!r.ok){
      const retryAfter=Number(r.headers.get("retry-after")||0)||0;
      const reset=Number(r.headers.get("x-ratelimit-reset")||0)||0;
      const remaining=r.headers.get("x-ratelimit-remaining");
      const err=Object.assign(new Error(data.message||`GitHub request failed (${r.status})`),{status:r.status,data,headers:{retryAfter,reset,remaining}});
      if(r.status===403||r.status===429){
        if(retryAfter)err.retryAfter=retryAfter;
        else if(remaining==="0"&&reset)err.retryAfter=Math.max(1,reset-Math.floor(Date.now()/1000));
        else if(r.status===403 && /rate limit|secondary rate limit/i.test(String(data.message||"")))err.retryAfter=60;
        err.code=remaining==="0"?"GITHUB_RATE_LIMIT":"GITHUB_FORBIDDEN";
      }
      throw err;
    }
    return data;
  }catch(e){
    if(e?.name==="AbortError"&&!callerSignal?.aborted)throw Object.assign(new Error(`GitHub request timed out after ${Math.round(timeoutMs/1000)} seconds.`),{code:"GITHUB_TIMEOUT",retryable:true});
    if(e?.code==="ECONNRESET"||e?.code==="ETIMEDOUT"||/fetch failed|network/i.test(String(e?.message||"")))throw Object.assign(new Error(e.message||"Unable to reach GitHub."),{code:e.code||"GITHUB_NETWORK_ERROR",retryable:true});
    throw e;
  }finally{
    clearTimeout(timer);
    if(callerSignal)callerSignal.removeEventListener("abort",abortCaller);
  }
}
// GitHub can 404 when reading the tree of a commit whose tree is genuinely
// empty (e.g. a commit that deleted every file), even though the commit and
// branch are both real — a documented GitHub API quirk (confirmed by
// GitHub's own community forum), not a sign that anything is actually
// missing. Treat that specific case as a real, empty tree instead of
// surfacing a confusing "Not Found" for what is a legitimate repo state.
async function readTreeOrEmpty(token,path){
  try{ return await gh(token,path); }
  catch(e){ if(e.status===404) return {tree:[]}; throw e; }
}
async function getGitHubRepo(token,owner,name){
  try{return await gh(token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,{timeoutMs:25000});}
  catch(e){if(Number(e?.status)===404)return null;throw e;}
}
function isAmbiguousCreateError(e){return !!e&&(e.code==="GITHUB_TIMEOUT"||e.code==="GITHUB_NETWORK_ERROR"||e.status===502||e.status===503||e.status===504||e.status===422);}
async function recoverCreatedRepo(token,owner,name){
  try{
    // A POST can succeed on GitHub even when its response is lost by a mobile/WebView connection.
    return await getGitHubRepo(token,owner,name);
  }catch(e){
    if(e?.status===403||e?.status===429)throw e;
    return null;
  }
}

function origin(req){const proto=(req.headers["x-forwarded-proto"]||"https").split(",")[0];const host=req.headers["x-forwarded-host"]||req.headers.host;return `${proto}://${host}`;}
function oauthStateKey(state){return crypto.createHash("sha256").update(String(state)).digest("hex");}
async function rememberOAuthState(state,redirectUri,extra={}){
  const key=oauthStateKey(state),record={createdAt:Date.now(),redirectUri:String(redirectUri||""),...extra};
  memory.oauthStates.set(key,record);
  // Firestore makes the state available across Vercel serverless instances.
  // This is the cookie-loss fallback needed by Android WebViews/custom tabs.
  if(db){await db.collection("wydev_oauth_states").doc(key).set(record);}
}
async function consumeOAuthState(state){
  const key=oauthStateKey(state),local=memory.oauthStates.get(key);
  memory.oauthStates.delete(key);
  if(local){
    if(Date.now()-Number(local.createdAt)>10*60*1000)return null;
    return local;
  }
  if(!db)return null;
  const ref=db.collection("wydev_oauth_states").doc(key),snap=await ref.get();
  if(!snap.exists)return null;
  const record=snap.data()||{};
  await ref.delete();
  if(Date.now()-Number(record.createdAt)>10*60*1000)return null;
  return record;
}
function clearOAuthCookie(res){
  const current=res.getHeader("Set-Cookie");
  const cleared="wydev_oauth_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0";
  res.setHeader("Set-Cookie",[current,cleared].filter(Boolean).flat());
}
async function oauthStart(req,res){
  const state=b64(crypto.randomBytes(32));
  const redirectUri=process.env.GITHUB_REDIRECT_URI||`${origin(req)}/api/auth/github/callback`;
  await rememberOAuthState(state,redirectUri,{provider:"github"});
  const url=new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id",process.env.GITHUB_CLIENT_ID||"");
  url.searchParams.set("redirect_uri",redirectUri);
  url.searchParams.set("scope","read:user repo workflow delete_repo");
  url.searchParams.set("state",state);
  // SameSite=None is intentional: Android WebViews/custom tabs can cross a
  // browser boundary during the GitHub redirect. Secure is mandatory with it.
  res.setHeader("Set-Cookie",`wydev_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`);
  redirect(res,url.toString());
}
async function oauthCallback(req,res){
  const q=new URL(req.url,origin(req)).searchParams;
  const state=q.get("state"),code=q.get("code");
  const cookies=parseCookies(req);
  if(!state)return json(res,400,{error:"Invalid OAuth state"});
  const cookieMatches=Boolean(cookies.wydev_oauth_state&&cookies.wydev_oauth_state===state);
  // Normal browsers are protected by the HttpOnly state cookie. If an Android
  // wrapper loses that cookie while following GitHub's redirect, consume the
  // same one-time state from Firestore instead of disabling state validation.
  let stateRecord=null;
  if(cookieMatches){
    stateRecord=await consumeOAuthState(state);
  }else if(db){
    stateRecord=await consumeOAuthState(state);
  }
  if(!stateRecord&&!cookieMatches)return json(res,400,{error:"Invalid OAuth state",code:"OAUTH_STATE_MISSING"});
  if(stateRecord&&!(["github","github-link"].includes(stateRecord.provider)))return json(res,400,{error:"Invalid OAuth provider state",code:"OAUTH_PROVIDER_MISMATCH"});
  if(!code){clearOAuthCookie(res);return json(res,400,{error:"GitHub did not return an authorization code"});}
  const redirectUri=process.env.GITHUB_REDIRECT_URI||`${origin(req)}/api/auth/github/callback`;
  if(stateRecord?.redirectUri&&String(stateRecord.redirectUri)!==String(redirectUri)){clearOAuthCookie(res);return json(res,400,{error:"Invalid OAuth redirect"});}
  const r=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code,redirect_uri:redirectUri})});
  const token=await r.json();
  if(!r.ok||!token.access_token){clearOAuthCookie(res);return json(res,502,{error:"GitHub token exchange failed"});}
  const me=await gh(token.access_token,"/user");
  const linkMode=stateRecord?.provider==="github-link";
  if(linkMode){
    const current=session(req);
    if(!current?.id)return json(res,401,{error:"Your sign-in session expired. Start again.",code:"SESSION_EXPIRED"});
    if(stateRecord?.userId&&String(stateRecord.userId)!==String(current.id))return json(res,403,{error:"The GitHub connection request belongs to a different sign-in session.",code:"OAUTH_SESSION_MISMATCH"});
    if(current.googleSub&&db){
      const existing=await db.collection("wydev_auth_google").doc(String(current.googleSub)).get();
      if(existing.exists&&String(existing.data()?.userId||"")!==String(me.id))return json(res,409,{error:"This Google account is already linked to another GitHub account.",code:"GOOGLE_ACCOUNT_LINKED"});
    }
    if(db&&current.googleSub){
      await db.collection("wydev_auth_google").doc(String(current.googleSub)).set({userId:String(me.id),email:String(current.email||""),updatedAt:Date.now()},{merge:true});
    }
    setSession(res,{token:token.access_token,refresh_token:token.refresh_token||null,login:me.login,id:me.id,name:me.name||current.name,avatar:me.avatar_url||current.avatar,scope:token.scope,provider:"github",githubConnected:true,email:current.email||null,emailVerified:current.emailVerified!==false,googleSub:current.googleSub||null});
    clearOAuthCookie(res);
    return redirect(res,"/");
  }
  setSession(res,{token:token.access_token,refresh_token:token.refresh_token||null,login:me.login,id:me.id,name:me.name,avatar:me.avatar_url,scope:token.scope,provider:"github",githubConnected:true,email:me.email||null,emailVerified:!!me.email});
  clearOAuthCookie(res);
  redirect(res,"/");
}


async function rememberGoogleState(state,userId,redirectUri){
  const key=oauthStateKey(state),record={createdAt:Date.now(),redirectUri:String(redirectUri||""),userId:String(userId),provider:"google-drive"};
  memory.oauthStates.set(key,record); if(db)await db.collection("wydev_oauth_states").doc(key).set(record);
}
async function googleLoginStart(req,res){
  const clientId=String(process.env.GOOGLE_CLIENT_ID||"").trim(),secret=String(process.env.GOOGLE_CLIENT_SECRET||"").trim();
  if(!clientId||!secret)return json(res,503,{error:"Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel."});
  const state=b64(crypto.randomBytes(32)),redirectUri=process.env.GOOGLE_REDIRECT_URI||`${origin(req)}/api/auth/google/callback`;
  await rememberOAuthState(state,redirectUri,{provider:"google-login"});
  const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id",clientId);u.searchParams.set("redirect_uri",redirectUri);u.searchParams.set("response_type","code");u.searchParams.set("access_type","online");u.searchParams.set("prompt","select_account");u.searchParams.set("scope","openid email profile");u.searchParams.set("state",state);
  res.setHeader("Set-Cookie",`wydev_google_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`);
  return redirect(res,u.toString());
}
async function googleLoginCallback(req,res,record,code){
  const clientId=String(process.env.GOOGLE_CLIENT_ID||"").trim(),secret=String(process.env.GOOGLE_CLIENT_SECRET||"").trim(),redirectUri=process.env.GOOGLE_REDIRECT_URI||`${origin(req)}/api/auth/google/callback`;
  const tokenResp=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:secret,redirect_uri:redirectUri,grant_type:"authorization_code"})});
  const token=await tokenResp.json();
  if(!tokenResp.ok||!token.access_token)return redirect(res,"/?google=error&reason=GOOGLE_LOGIN_TOKEN_FAILED");
  const infoResp=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${token.access_token}`}});
  const info=await infoResp.json();
  if(!infoResp.ok||!info.sub||!info.email)return redirect(res,"/?google=error&reason=GOOGLE_PROFILE_FAILED");
  if(info.email_verified===false)return redirect(res,"/?google=error&reason=GOOGLE_EMAIL_NOT_VERIFIED");
  const userId=`google:${String(info.sub)}`;
  const githubConnected=false;
  const githubLogin="";
  setSession(res,{token:null,refresh_token:null,login:githubLogin,id:userId,name:info.name||info.email.split("@")[0],avatar:info.picture||"",scope:"openid email profile",provider:"google",githubConnected,email:String(info.email),emailVerified:true,googleSub:String(info.sub)});
  res.setHeader("Set-Cookie","wydev_google_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
  return redirect(res,"/");
}
async function googleDriveStart(req,res){
  const s=requireSession(req,res);if(!s)return;
  const clientId=String(process.env.GOOGLE_CLIENT_ID||"").trim(),secret=String(process.env.GOOGLE_CLIENT_SECRET||"").trim();
  if(!clientId||!secret)return json(res,503,{error:"Google Drive integration is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel."});
  const state=b64(crypto.randomBytes(32)),redirectUri=process.env.GOOGLE_REDIRECT_URI||`${origin(req)}/api/auth/google/callback`;
  await rememberGoogleState(state,s.id,redirectUri);
  const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id",clientId);u.searchParams.set("redirect_uri",redirectUri);u.searchParams.set("response_type","code");u.searchParams.set("access_type","offline");u.searchParams.set("prompt","consent");u.searchParams.set("include_granted_scopes","true");u.searchParams.set("scope","openid email https://www.googleapis.com/auth/drive.file");u.searchParams.set("state",state);
  res.setHeader("Set-Cookie",`wydev_google_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`);return redirect(res,u.toString());
}
async function googleDriveCallback(req,res){
  const q=new URL(req.url,origin(req)).searchParams,state=q.get("state"),code=q.get("code"),oauthError=q.get("error");if(!state)return json(res,400,{error:"Invalid Google OAuth state"});
  const record=await consumeOAuthState(state);if(!record||!(["google-drive","google-login"].includes(record.provider)))return json(res,400,{error:"Invalid or expired Google OAuth state"});
  if(record.provider==="google-login"){
    if(oauthError)return redirect(res,`/?google=error&reason=${encodeURIComponent(oauthError)}`);
    if(!code)return json(res,400,{error:"Google did not return an authorization code"});
    return googleLoginCallback(req,res,record,code);
  }
  if(oauthError)return redirect(res,`/?google=error&reason=${encodeURIComponent(oauthError)}#github`);
  if(!code)return json(res,400,{error:"Google did not return an authorization code"});
  const clientId=String(process.env.GOOGLE_CLIENT_ID||"").trim(),secret=String(process.env.GOOGLE_CLIENT_SECRET||"").trim(),redirectUri=process.env.GOOGLE_REDIRECT_URI||`${origin(req)}/api/auth/google/callback`;
  const tokenResp=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:secret,redirect_uri:redirectUri,grant_type:"authorization_code"})});
  if(!db)return redirect(res,"/?google=error&reason=GOOGLE_DRIVE_STORAGE_NOT_CONFIGURED#github");
  const token=await tokenResp.json();if(!tokenResp.ok||!token.access_token)return redirect(res,"/?google=error&reason=TOKEN_EXCHANGE_FAILED#github");
  const grantedScopes=String(token.scope||"").split(/[\s,]+/).filter(Boolean);
  if(!grantedScopes.includes("https://www.googleapis.com/auth/drive.file"))return redirect(res,"/?google=error&reason=DRIVE_FILE_SCOPE_NOT_GRANTED#github");
  if(!token.refresh_token)return redirect(res,"/?google=error&reason=NO_REFRESH_TOKEN#github");
  await db.collection("wydev_google_tokens").doc(String(record.userId)).set({encrypted:seal({access_token:token.access_token,refresh_token:token.refresh_token,expires_at:Date.now()+Number(token.expires_in||3600)*1000,scope:grantedScopes.join(" ")}),updatedAt:Date.now()},{merge:true});
  res.setHeader("Set-Cookie","wydev_google_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");return redirect(res,"/?google=connected#github");
}
async function getGoogleDriveToken(userId){
  if(!db)throw Object.assign(new Error("Google Drive requires Firebase persistence."),{status:503,code:"GOOGLE_DRIVE_NOT_CONFIGURED"});
  const snap=await db.collection("wydev_google_tokens").doc(String(userId)).get();if(!snap.exists)throw Object.assign(new Error("Connect Google Drive first."),{status:401,code:"GOOGLE_DRIVE_NOT_CONNECTED"});
  const row=snap.data()||{},t=openCookie(row.encrypted||"");if(!t)throw Object.assign(new Error("Google Drive connection expired. Reconnect Google Drive."),{status:401,code:"GOOGLE_DRIVE_RECONNECT"});
  if(Number(t.expires_at||0)>Date.now()+60000)return t.access_token;
  if(!t.refresh_token)throw Object.assign(new Error("Google Drive authorization expired. Reconnect Google Drive."),{status:401,code:"GOOGLE_DRIVE_RECONNECT"});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:String(process.env.GOOGLE_CLIENT_ID||""),client_secret:String(process.env.GOOGLE_CLIENT_SECRET||""),refresh_token:t.refresh_token,grant_type:"refresh_token"})});
  const d=await r.json();if(!r.ok||!d.access_token)throw Object.assign(new Error("Google Drive authorization expired. Reconnect Google Drive."),{status:401,code:"GOOGLE_DRIVE_RECONNECT"});
  const next={...t,access_token:d.access_token,expires_at:Date.now()+Number(d.expires_in||3600)*1000};await db.collection("wydev_google_tokens").doc(String(userId)).set({encrypted:seal(next),updatedAt:Date.now()},{merge:true});return next.access_token;
}
async function googleDriveStatus(req,res){
  const s=requireSession(req,res);if(!s)return;
  if(!db)return json(res,200,{connected:false});
  const snap=await db.collection("wydev_google_tokens").doc(String(s.id)).get();
  return json(res,200,{connected:snap.exists&&!!(snap.data()||{}).encrypted});
}
// Lets a user revoke WyteLab's Google Drive access from inside the app itself,
// not only from myaccount.google.com — required so people have a real control
// over the connected-app grant, and expected by Marketplace/OAuth reviewers.
async function googleDriveDisconnect(req,res){
  const s=requireSession(req,res);if(!s)return;
  if(db){
    const snap=await db.collection("wydev_google_tokens").doc(String(s.id)).get();
    if(snap.exists){
      const t=openCookie((snap.data()||{}).encrypted||"");
      const revokeToken=t?.refresh_token||t?.access_token;
      if(revokeToken){
        let revokeResponse;
        try{
          revokeResponse=await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:revokeToken})});
        }catch(err){
          return json(res,502,{error:"Google could not be reached to revoke access. Your WyteLab connection was kept active; please try Disconnect again."});
        }
        // Google returns 200 for a successful revoke. A 400 can also mean the token
        // is already invalid/revoked, so it is safe to remove our local credential.
        if(!revokeResponse.ok && revokeResponse.status!==400){
          return json(res,502,{error:`Google could not confirm access revocation (${revokeResponse.status}). Your WyteLab connection was kept active; please try again.`});
        }
      }
      await db.collection("wydev_google_tokens").doc(String(s.id)).delete();
    }
  }
  return json(res,200,{connected:false});
}

async function exportRepoToDrive(s,owner,repo,branch){
  const token=await getGoogleDriveToken(s.id),ref=String(branch||"").trim()||"HEAD";
  const r=await fetch(`${GH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(ref)}`,{headers:ghHeaders(s.token),redirect:"follow"});
  if(!r.ok)throw Object.assign(new Error(`GitHub could not create the repository archive (${r.status}).`),{status:r.status});
  const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>25*1024*1024)throw Object.assign(new Error("Repository archive is larger than 25 MB. Open GitHub to download the full archive."),{status:413,code:"DRIVE_EXPORT_TOO_LARGE"});const boundary=`----WyteLab${crypto.randomBytes(8).toString("hex")}`,meta=JSON.stringify({name:`${repo}-${ref.replace(/[^a-zA-Z0-9._-]/g,"_")}.zip`,mimeType:"application/zip"});
  const pre=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`),post=Buffer.from(`\r\n--${boundary}--\r\n`);
  const up=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":`multipart/related; boundary=${boundary}`},body:Buffer.concat([pre,bytes,post])});
  const d=await up.json();
  if(!up.ok){
    const msg=String(d?.error?.message||"");
    const scopeProblem=up.status===401||(up.status===403&&/insufficient|scope|permission/i.test(msg));
    if(scopeProblem && db) await db.collection("wydev_google_tokens").doc(String(s.id)).delete().catch(()=>{});
    throw Object.assign(new Error(scopeProblem?"Google Drive authorization needs to be refreshed. Reconnect Google Drive and try again.":(msg||`Google Drive upload failed (${up.status})`)),{status:scopeProblem?401:up.status,code:scopeProblem?"GOOGLE_DRIVE_RECONNECT":undefined});
  }
  return d;
}

function limitKey(s){return `${s.id||s.login}:${new Date().toISOString().slice(0,10)}`;}
async function entitlement(s){if(hasReviewerProAccess(s))return "pro";const e=await getEntitlement(s.id);return e?.status==="active"&&(!e.expiresAt||e.expiresAt>Date.now())?"pro":"free";}
async function checkAIQuota(s){const day=new Date().toISOString().slice(0,10),used=await getUsage(s.id,day),plan=await entitlement(s),limit=Math.max(1,plan==="pro"?Number(process.env.AI_PRO_DAILY_LIMIT||5):Number(process.env.AI_FREE_DAILY_LIMIT||3));if(used>=limit)throw Object.assign(new Error(`Daily AI diagnostic limit reached (${limit}). Try again tomorrow.`),{status:429,code:"AI_QUOTA_EXCEEDED",limit,used,plan});return {day,plan,limit,used};}
// Redacts likely secrets before code is sent to the AI. This must NEVER
// corrupt the surrounding code -- mangled output reads to the model (and to
// a human) exactly like a truncated/broken file, which produces false "this
// code is broken" diagnoses instead of real ones. So every rule below only
// fires on something shaped like an actual literal secret, and always
// preserves the quote characters it matched inside.
function redactSecrets(value){
  let s=String(value||"");
  // Real PEM private key blocks have a substantial base64 body between the
  // markers. Require a minimum body length so this doesn't also match the
  // *description* of that pattern -- e.g. this very regex's own source text,
  // which appears verbatim when this file is diagnosed.
  s=s.replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]{40,}?-----END [^-]+ PRIVATE KEY-----/gi,"[REDACTED_PRIVATE_KEY]");
  // Strings shaped like real provider credentials, regardless of what
  // variable they're assigned to.
  s=s.replace(/(ghp_|github_pat_|sk-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]{20,})[A-Za-z0-9_-]*/g,"[REDACTED_TOKEN]");
  // "<secret-ish keyword>: <quoted literal>" pairs. \b keeps this from
  // matching a keyword that's merely a suffix of a longer identifier (e.g.
  // FLW_TOKEN, SESSION_SECRET used as a *name*, not a leaked value). Requiring
  // an actual quoted literal of plausible secret length keeps this from
  // matching bare expressions/object literals (e.g. `authorization={...}`,
  // `secret:process.env.X`), which have no leakable value to redact in the
  // first place. The quote characters are preserved in the replacement so
  // the surrounding code stays syntactically valid.
  s=s.replace(/\b(api[_-]?key|secret|password|token|authorization)\b(\s*[:=]\s*)(["'`])((?:(?!\3)[^\\]|\\.){12,}?)\3/gi,
    (m,kw,sep,q)=>`${kw}${sep}${q}[REDACTED]${q}`);
  return s;
}
function parseGeminiText(data){return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";}
async function geminiDiagnose(prompt,schema,opts={}){
  // Gemini-only provider chain. These are current stable Gemini 3 models;
  // each failure falls through to the next active model rather than falling
  // back to an unrelated provider. GEMINI_MODEL may select the first model,
  // while GEMINI_FALLBACK_MODELS can add/reorder stable Gemini models.
  const stable=[
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
  ];
  const configured=[String(process.env.GEMINI_MODEL||"").trim(),...String(process.env.GEMINI_FALLBACK_MODELS||"").split(",").map(x=>x.trim()).filter(Boolean)];
  const active=new Set(stable); const models=[...configured,...stable].filter((x,i,a)=>x&&active.has(x)&&a.indexOf(x)===i);
  const failures=[];
  const key=String(process.env.GEMINI_API_KEY||"").trim();
  if(!key) throw Object.assign(new Error("Gemini AI is not configured. Set GEMINI_API_KEY in Vercel."),{status:503,code:"GEMINI_NOT_CONFIGURED"});
  for(const model of models){
    try{
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:opts.maxOutputTokens||500,responseMimeType:"application/json",responseSchema:schema}})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok){failures.push(`${model}: ${data?.error?.message||r.status}`);continue;}
      const text=parseGeminiText(data); if(!text) throw new Error("empty response");
      const out=JSON.parse(text); const valid=opts.validate?opts.validate(out):(out.root_cause&&Array.isArray(out.affected_files)&&Array.isArray(out.evidence));
      if(!valid) throw new Error("AI response validation failed");
      return out;
    }catch(e){failures.push(`${model}: ${e.message}`)}
  }
  throw Object.assign(new Error("All configured Gemini models were unavailable. Try again shortly."),{status:503,code:"GEMINI_ALL_MODELS_FAILED",details:failures.slice(-6)});
}
async function aiDiagnose(s,payload){
  const quota=await checkAIQuota(s);
  const files=Array.isArray(payload.relatedFiles)?payload.relatedFiles.slice(0,8):[];
  const context=JSON.stringify({error:redactSecrets(payload.error),logs:redactSecrets(String(payload.logs||"").slice(0,12000)),file:redactSecrets(payload.file),content:redactSecrets(String(payload.content||"").slice(0,24000)),relatedFiles:files.map(x=>({path:redactSecrets(x.path),content:redactSecrets(String(x.content||"").slice(0,10000))})),package:redactSecrets(payload.package)});
  const schema={type:"object",properties:{title:{type:"string"},severity:{type:"string"},root_cause:{type:"string"},affected_files:{type:"array",items:{type:"string"}},affected_lines:{type:"array",items:{type:"string"}},evidence:{type:"array",items:{type:"string"}},likely_reason:{type:"string"},recommended_action:{type:"string"},confidence:{type:"number"}},required:["title","severity","root_cause","affected_files","affected_lines","evidence","likely_reason","recommended_action","confidence"]};
  const prompt=`You are WyteLab Diagnostic Engine. Diagnose only. NEVER edit code, generate patches, replace files, commit, push, rename files, or perform autonomous actions. Identify the exact problem from the supplied minimum context. If evidence is insufficient, say so. Return only valid JSON matching the supplied schema. Keep the diagnosis very concise: identify the problem, evidence, and next action in short sentences; do not write a long explanation.\nCONTEXT:\n${context}`;
  const out=await geminiDiagnose(prompt,schema,{maxOutputTokens:700});
  const used=await incrementUsage(s.id,quota.day,quota.limit);
  return {...out,usage:{used,limit:quota.limit,remaining:Math.max(0,quota.limit-used),plan:quota.plan}};
}

// Whole-repository diagnosis: instead of one file plus a handful of "related"
// files, this walks the entire fetched file set (skipping binaries, lockfiles
// and anything past the char budget) so the model reasons about cross-file
// problems -- inconsistent patterns, missing error handling, structural and
// architectural issues -- not just what's wrong in whatever single file the
// user happened to have open. Still diagnosis-only, still one AI credit.
// Budgeted generously (well above this repo's ~230KB of source) so ordinary
// projects are sent in full; per-file cap is likewise sized above the
// largest files WyteLab itself ships so real files aren't cut mid-function.
const REPO_CONTEXT_CHAR_BUDGET=550000;
const REPO_PER_FILE_CHAR_CAP=90000;
const TRUNCATION_MARKER="\n/* [WYDEV DIAGNOSTIC NOTE: file content cut off here because it exceeded the diagnosis size budget. This is NOT a bug in the source file -- it is only how much of it could be included in this analysis. Do not report this cutoff itself as an issue. */";
async function aiDiagnoseRepo(s,payload){
  const quota=await checkAIQuota(s);
  const incoming=Array.isArray(payload.files)?payload.files:[];
  let used=0;
  const omitted=[];
  const included=[];
  for(const f of incoming){
    const path=redactSecrets(String(f?.path||"")).slice(0,300);
    if(!path){continue}
    let content=String(f?.content||"");
    let truncated=false;
    if(content.length>REPO_PER_FILE_CHAR_CAP){content=content.slice(0,REPO_PER_FILE_CHAR_CAP)+TRUNCATION_MARKER;truncated=true}
    content=redactSecrets(content);
    const entryLen=path.length+content.length+48;
    if(used+entryLen>REPO_CONTEXT_CHAR_BUDGET){omitted.push(f.path);continue}
    used+=entryLen;
    included.push({path,content,truncated});
  }
  const context=JSON.stringify({repo:redactSecrets(payload.repo||""),branch:redactSecrets(payload.branch||""),fileCountTotal:incoming.length,fileCountIncluded:included.length,files:included});
  const schema={type:"object",properties:{
    summary:{type:"string"},
    overall_risk:{type:"string"},
    architecture_notes:{type:"string"},
    issues:{type:"array",items:{type:"object",properties:{
      title:{type:"string"},severity:{type:"string"},affected_files:{type:"array",items:{type:"string"}},
      root_cause:{type:"string"},evidence:{type:"array",items:{type:"string"}},recommended_action:{type:"string"}
    },required:["title","severity","affected_files","root_cause","evidence","recommended_action"]}},
    confidence:{type:"number"}
  },required:["summary","overall_risk","architecture_notes","issues","confidence"]};
  const prompt=`You are WyteLab's Repository Diagnostic Engine. You are given the contents of an entire codebase (as many files as fit within the supplied context budget). Diagnose only. NEVER edit code, generate patches, rewrite files, commit, push, rename files, or perform autonomous actions.\nIMPORTANT -- read this before diagnosing: some file values in the payload have "truncated": true and end with a WYDEV DIAGNOSTIC NOTE comment. That comment marks where THIS TOOL cut the file off to stay within its own size budget -- it is not part of the real source file and is never itself a code problem. A file ending abruptly right before that marker is expected and must NOT be reported as "truncated code", "incomplete implementation", or similar. Only report a file as incomplete/broken if the evidence for that appears BEFORE the marker, in code the file's author actually wrote. Likewise, values shown as [REDACTED], [REDACTED_TOKEN], or [REDACTED_PRIVATE_KEY] are secrets this tool intentionally masked before sending you the code -- never report these placeholders as syntax errors, missing values, or broken code.\nPerform a DEEP, holistic diagnosis across the whole repository, not just one file in isolation:\n- Find concrete bugs and correctness issues, including ones that only show up when files interact (mismatched contracts between frontend/backend, inconsistent field names, wrong endpoints, race conditions).\n- Flag structural and architectural risks: duplicated logic, dead code, missing error handling, inconsistent patterns between similar files, security issues (secrets, injection, auth gaps), fragile assumptions.\n- Group findings into discrete "issues", each naming the exact affected file paths and citing concrete evidence (function/variable names, line-level detail) from the supplied content -- never invent files or code that was not given to you.\n- If the supplied context is insufficient to be sure about something, say so in that issue instead of guessing.\nReturn only valid JSON matching the supplied schema. Keep it extremely concise: at most 5 important issues, short direct phrases, no long explanations, no essays, and no repeated context.\nCONTEXT:\n${context}`;
  const out=await geminiDiagnose(prompt,schema,{maxOutputTokens:700,validate:o=>o&&typeof o.summary==="string"&&Array.isArray(o.issues)});
  const quotaUsed=await incrementUsage(s.id,quota.day,quota.limit);
  return {...out,filesTotal:incoming.length,filesAnalyzed:included.length,omittedFiles:omitted,usage:{used:quotaUsed,limit:quota.limit,remaining:Math.max(0,quota.limit-quotaUsed),plan:quota.plan}};
}

function flwRequestId(prefix){return `${prefix}${crypto.randomBytes(18).toString("hex")}`;}
async function flwToken(){
  if(memory.flwToken&&Number(memory.flwToken.expiresAt)>Date.now()+30000)return memory.flwToken.value;
  const clientId=String(process.env.FLW_CLIENT_ID||"").trim();
  const clientSecret=String(process.env.FLW_CLIENT_SECRET||"").trim();
  if(!clientId||!clientSecret)throw Object.assign(new Error("Flutterwave v4 credentials are not configured. Set FLW_CLIENT_ID and FLW_CLIENT_SECRET in Vercel."),{status:500,code:"FLW_CREDENTIALS_MISSING"});
  const r=await fetch(FLW_TOKEN,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"client_credentials"})});
  const text=await r.text();let d={};try{d=text?JSON.parse(text):{}}catch{d={message:text}}
  if(!r.ok||!d.access_token){
    const detail=d?.error_description||d?.error?.message||d?.message||`HTTP ${r.status}`;
    throw Object.assign(new Error(`Flutterwave authentication failed (${r.status}): ${detail}`),{status:r.status,code:d?.error?.code||d?.error||"FLW_AUTH_FAILED"});
  }
  const expiresIn=Math.max(60,Number(d.expires_in)||300);
  memory.flwToken={value:d.access_token,expiresAt:Date.now()+expiresIn*1000};
  return d.access_token;
}
async function flw(path,opts={}){
  const token=await flwToken();
  const trace=flwRequestId("WYTRACE");
  const idempotency=flwRequestId("WYREQ");
  const headers={"Authorization":`Bearer ${token}`,"Accept":"application/json","Content-Type":"application/json","X-Trace-Id":trace,"X-Idempotency-Key":String(opts.idempotencyKey||idempotency),...(opts.headers||{})};
  if(process.env.FLW_SCENARIO_KEY)headers["X-Scenario-Key"]=String(process.env.FLW_SCENARIO_KEY);
  const url=FLW_BASE+path;
  const r=await fetch(url,{...opts,headers});
  const t=await r.text();let d;try{d=t?JSON.parse(t):{}}catch{d={message:t}}
  if(!r.ok){
    const validation=Array.isArray(d?.error?.validation_errors)?d.error.validation_errors.map(v=>`${v.field_name}: ${v.message}`).join("; "):""; const detail=validation||d?.error?.message||d?.error?.type||d?.message||d?.error_description||`HTTP ${r.status}`;
    const code=d?.error?.code||d?.code||null;
    let message=code?`Flutterwave ${code}: ${detail}`:`Flutterwave request failed (${r.status}): ${detail}`;
    if(r.status===403||String(code)==="10403")message+=` [Forbidden at ${path}. Environment: ${FLW_LIVE?"production":"sandbox"}. Base: ${FLW_BASE}. Check that FLW_ENV matches your v4 credential environment and that the live account has the required API permissions/KYC. Trace: ${trace}]`;
    const err=new Error(message);
    throw Object.assign(err,{status:r.status,data:d,flutterwaveCode:code,traceId:trace,endpoint:path});
  }
  return d;
}
function amountFor(currency){if(currency==="NGN"){const n=Number(process.env.FLW_PRO_NGN||7500);if(!n)throw new Error("FLW_PRO_NGN is required for NGN checkout");return n}return Number(process.env.FLW_PRO_USD||7);}

async function findCustomerByEmail(email){
  // Flutterwave v4 does not document a customer-search endpoint consistently across environments,
  // so this tries the conventional filter param and falls back to a full list scan if unsupported.
  try{
    const q=await flw(`/customers?email=${encodeURIComponent(email)}`);
    const hit=(Array.isArray(q.data)?q.data:[q.data]).find(c=>c&&String(c.email||"").toLowerCase()===email.toLowerCase());
    if(hit?.id)return hit.id;
  }catch{}
  try{
    const all=await flw("/customers");
    const hit=(Array.isArray(all.data)?all.data:[]).find(c=>String(c?.email||"").toLowerCase()===email.toLowerCase());
    if(hit?.id)return hit.id;
  }catch{}
  return null;
}
async function resolveCustomerId(customerPayload){
  try{
    const customer=await flw("/customers",{method:"POST",body:JSON.stringify(customerPayload)});
    const customerId=customer.data?.id;
    if(!customerId)throw new Error("Flutterwave did not return a customer id");
    return customerId;
  }catch(e){
    const alreadyExists=String(e.flutterwaveCode)==="1203409"||/already exists/i.test(e.message||"");
    if(!alreadyExists)throw e;
    // The error body itself sometimes carries the existing customer id (varies by account/version);
    // check there first before falling back to a lookup call.
    const inline=e.data?.error?.data?.id||e.data?.data?.id||e.data?.error?.id;
    if(inline)return inline;
    const found=await findCustomerByEmail(customerPayload.email);
    if(found)return found;
    throw Object.assign(new Error(`Flutterwave reports a customer already exists for ${customerPayload.email}, but WyteLab could not look up its ID to reuse it. Trace: ${e.traceId||"n/a"}`),{status:e.status||500});
  }
}
async function createBillingCheckout(s,payload){
  requirePersistence();
  const currency=payload.currency==="NGN"?"NGN":"USD", amount=amountFor(currency), reference=`WYDEV-${String(s.id).slice(0,12)}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
  const fullName=String(payload.name||"").trim();
  const [firstName,...restName]=fullName?fullName.split(/\s+/):[];
  const customerPayload={email:payload.email||`${s.login}@users.noreply.github.com`,name:{first:firstName||s.name||s.login,...(restName.length?{last:restName.join(" ")}:{})},meta:{github_id:String(s.id)}};
  if(payload.payment_method?.type!=="card")throw new Error("Select card checkout.");
  const existing=await getEntitlement(s.id);
  const customerId=existing?.customerId||await resolveCustomerId(customerPayload);
  const pm=await flw("/payment-methods",{method:"POST",body:JSON.stringify({type:"card",card:payload.payment_method.card})});
  const paymentMethodId=pm.data?.id;
  if(!paymentMethodId)throw new Error("Flutterwave did not return a payment method id");
  await setTransaction(reference,{userId:String(s.id),amount,currency,status:"initiating",customerId,paymentMethodId,createdAt:Date.now(),renewal:false});
  const charge=await flw("/charges",{method:"POST",idempotencyKey:reference,body:JSON.stringify({amount,currency,reference,customer_id:customerId,payment_method_id:paymentMethodId,redirect_url:`${origin(payload.req)}/?billing=return&tx_ref=${encodeURIComponent(reference)}#billing`,recurring:false})});
  await setTransaction(reference,{status:charge.data?.status||"pending",chargeId:charge.data?.id,updatedAt:Date.now()});
  return charge;
}
async function authorizeCharge(s,id,authorization,reference){
  if(!id||!authorization?.type||!reference)throw Object.assign(new Error("Charge id, transaction reference and authorization are required"),{status:400});
  const expected=await getTransaction(String(reference));
  if(!expected||String(expected.userId)!==String(s.id))throw Object.assign(new Error("Transaction does not belong to this account"),{status:403});
  if(!expected.chargeId||String(expected.chargeId)!==String(id))throw Object.assign(new Error("Charge does not match the pending transaction"),{status:409});
  const d=await flw(`/charges/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify({authorization})});
  return d;
}
function addOneMonth(ts){
  const d=new Date(Number(ts)||Date.now()),day=d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth()+1);
  if(d.getUTCDate()!==day){d.setUTCDate(0)}
  return d.getTime();
}
function daysUntil(ts){const a=new Date();const b=new Date(Number(ts)||0);const utc=(d)=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());return Math.round((utc(b)-utc(a))/86400000)}
async function runScheduledNotifications(){
  if(!db)return {morning:0,repoWarnings:0,renewalWarnings:0};
  let morning=0,repoWarnings=0,renewalWarnings=0;
  const active=await db.collection("wydev_entitlements").where("status","==","active").limit(500).get();
  for(const doc of active.docs){
    const e=doc.data(),uid=doc.id,days=daysUntil(e.renewAt);
    if(days===10||days===5) renewalWarnings+=await sendPushOnce(uid,`renewal:${e.renewAt}:${days}`,"WyteLab Pro renewal reminder",`Your Pro subscription renews in ${days} days. Your Pro access stays active while renewal succeeds.`,{type:"renewal",days:String(days)});
  }
  const subs=await db.collection("wydev_fcm_tokens").where("enabled","==",true).limit(1000).get();
  const users=new Map();
  for(const doc of subs.docs){const t=doc.data(); if(!users.has(String(t.userId))) users.set(String(t.userId),String(t.timezone||"UTC"));}
  const now=new Date();
  for(const [uid,tz] of users){
    let hour=-1,dateKey="";
    try{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz,hour:"2-digit",hour12:false,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));hour=Number(m.hour);dateKey=`${m.year}-${m.month}-${m.day}`;}catch{}
    if(hour>=7&&hour<=10) morning+=await sendPushOnce(uid,`good-morning:${dateKey}`,"Good morning ☀️","Good morning! Your GitHub workspace is ready. Pick a repository and keep building.",{type:"morning"});
  }
  return {morning,repoWarnings,renewalWarnings};
}
async function claimRenewal(userId,reference){
  if(!db)return true;
  const ref=db.collection("wydev_entitlements").doc(String(userId));
  const now=Date.now();
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists)return false;
    const e=snap.data()||{};
    if(e.status!=="active"||Number(e.renewAt||0)>now)return false;
    const started=Number(e.renewalStartedAt||0);
    if(e.renewalPending && started && now-started<6*60*60*1000)return false;
    tx.set(ref,{renewalPending:true,renewalStartedAt:now,renewalReference:reference,updatedAt:now},{merge:true});
    return true;
  });
}
async function renewDue(){
  const due=await listDueEntitlements(); let processed=0;
  for(const e of due){
    if(!e.customerId||!e.paymentMethodId||!e.currency)continue;
    try{
      const renewalAt=Number(e.renewAt||0),reference=`WYDEV-R-${String(e.id).slice(0,12)}-${renewalAt}`,amount=amountFor(e.currency);
      if(!(await claimRenewal(e.id,reference))) continue;
      const d=await flw("/charges",{method:"POST",idempotencyKey:reference,body:JSON.stringify({reference,currency:e.currency,amount,customer_id:e.customerId,payment_method_id:e.paymentMethodId,recurring:true})});
      const status=String(d.data?.status||"failed").toLowerCase();
      await setTransaction(reference,{userId:e.id,amount,currency:e.currency,status,chargeId:d.data?.id,customerId:e.customerId,paymentMethodId:e.paymentMethodId,createdAt:Date.now(),renewal:true});
      if(status==="succeeded"){
        const base=Math.max(Date.now(),Number(e.expiresAt)||0);
        const expiresAt=addOneMonth(base);
        await setEntitlement(e.id,{status:"active",expiresAt,renewAt:expiresAt,renewalPending:false,renewalStartedAt:null,renewalReference:null,updatedAt:Date.now(),lastRenewalReference:reference});
      }else{
        // Flutterwave documents recurring charges as terminal success/failure
        // charges. Never silently extend a pending/unknown result; the webhook
        // can restore the entitlement if the provider later reports success.
        await setEntitlement(e.id,{status:"past_due",renewalPending:false,renewalStartedAt:null,renewalReference:null,updatedAt:Date.now(),lastRenewalReference:reference});
      }
      processed++;
    }catch{await setEntitlement(e.id,{status:"past_due",renewalPending:false,renewalStartedAt:null,renewalReference:null,updatedAt:Date.now()});}
  }
  return processed;
}
async function cancelSubscription(s){
  requirePersistence();
  const existing=await getEntitlement(s.id);
  if(!existing||existing.status!=="active")return {active:existing?.status==="active"&&(!existing?.expiresAt||existing.expiresAt>Date.now()),cancelled:false};
  await setEntitlement(s.id,{status:"cancelled",renewAt:null,renewalPending:false,renewalStartedAt:null,renewalReference:null,cancelledAt:Date.now(),updatedAt:Date.now()});
  return {active:false,cancelled:true};
}
async function recoverEntitlement(s,requestedReference=""){
  requirePersistence();
  const existing=await getEntitlement(s.id);
  if(existing?.status==="active"&&(!existing.expiresAt||existing.expiresAt>Date.now()))return {active:true,expiresAt:existing.expiresAt,recovered:false};
  let transactions=await findRecentTransactions(s.id);
  const wanted=String(requestedReference||"").trim();
  if(wanted && wanted.startsWith(`WYDEV-${String(s.id).slice(0,12)}-`) && !transactions.some(t=>t.reference===wanted)){
    try{
      const list=await flw(`/charges?reference=${encodeURIComponent(wanted)}`);
      const rows=Array.isArray(list.data)?list.data:(list.data?[list.data]:[]);
      const hit=rows.find(x=>String(x.reference||"")===wanted);
      if(hit?.id){
        const tx={reference:wanted,userId:String(s.id),amount:Number(hit.amount),currency:String(hit.currency||""),status:hit.status||"pending",chargeId:hit.id,customerId:hit.customer_id||hit.customerId||null,paymentMethodId:hit.payment_method_details?.id||hit.payment_method_id||null,createdAt:Date.now(),recoveredFromFlutterwave:true};
        await setTransaction(wanted,tx);
        transactions=[tx,...transactions];
      }
    }catch{}
  }
  const recoveryCutoff=Date.now()-7*86400000;
  for(const tx of transactions){
    if(!tx.chargeId||!tx.amount||!tx.currency)continue;
    if(!wanted && Number(tx.createdAt||0)<recoveryCutoff) continue;
    try{
      const d=await flw(`/charges/${encodeURIComponent(tx.chargeId)}`),x=d.data||{};
      await setTransaction(tx.reference,{status:x.status||"pending",chargeId:tx.chargeId,updatedAt:Date.now()});
      if(x.status==="succeeded"&&String(x.reference||"")===String(tx.reference)&&Number(x.amount)===Number(tx.amount)&&String(x.currency)===String(tx.currency)){
        const expiresAt=addOneMonth(Date.now());
        await setEntitlement(s.id,{status:"active",expiresAt,renewAt:expiresAt,reference:tx.reference,customerId:tx.customerId||x.customer_id||null,paymentMethodId:tx.paymentMethodId||x.payment_method_details?.id||null,currency:tx.currency,updatedAt:Date.now(),recoveredAt:Date.now()});
        try{await sendPushOnce(s.id,`pro-unlocked:${tx.reference}`,"WyteLab Pro unlocked 🎉","Your Pro subscription is active.",{type:"pro_unlocked"})}catch{}
        return {active:true,expiresAt,recovered:true,reference:tx.reference};
      }
    }catch{}
  }
  return {active:false,expiresAt:null,recovered:false};
}

async function verifyCharge(s,id,reference){
  const ref=String(reference||"").trim();
  const expected=await getTransaction(ref);
  if(!expected||String(expected.userId)!==String(s.id))throw new Error("Transaction does not belong to this account");
  const existingEntitlement=await getEntitlement(s.id);
  if(String(expected.status||"").toLowerCase()==="succeeded" && String(existingEntitlement?.reference||"")===ref && existingEntitlement?.status==="active" && Number(existingEntitlement?.expiresAt||0)>Date.now()){
    return {active:true,status:"succeeded",expiresAt:existingEntitlement.expiresAt,replayed:true};
  }
  const chargeId=id||expected.chargeId;
  if(!chargeId)throw Object.assign(new Error("Payment transaction is still being created. Please wait a moment and try again."),{status:409});
  if(expected.chargeId&&String(expected.chargeId)!==String(chargeId))throw Object.assign(new Error("Charge does not match the pending transaction"),{status:409});
  const d=await flw(`/charges/${encodeURIComponent(chargeId)}`),x=d.data||{};
  const providerRef=String(x.reference||"");
  await setTransaction(ref,{status:x.status||"pending",chargeId,updatedAt:Date.now()});
  if(x.status==="succeeded"&&providerRef===ref&&Number(x.amount)===Number(expected.amount)&&String(x.currency)===String(expected.currency)){
    const expiresAt=addOneMonth(Date.now());
    await setEntitlement(s.id,{status:"active",expiresAt,renewAt:expiresAt,reference:ref,customerId:expected.customerId,paymentMethodId:expected.paymentMethodId,currency:expected.currency,updatedAt:Date.now()});
    try{await sendPushOnce(s.id,`pro-unlocked:${ref}`,"WyteLab Pro unlocked 🎉","Your Pro subscription is active. Pro limits now apply to repositories, AI, reverts and workflow reruns.",{type:"pro_unlocked"})}catch{}
    return {active:true,status:x.status,expiresAt};
  }
  return {active:false,status:x.status||"pending"};
}
function validWebhook(req,raw){const sig=req.headers["flutterwave-signature"];if(!sig||!process.env.FLW_WEBHOOK_SECRET_HASH)return false;const h=crypto.createHmac("sha256",process.env.FLW_WEBHOOK_SECRET_HASH).update(raw).digest("base64");const a=Buffer.from(h),b=Buffer.from(String(sig));return a.length===b.length&&crypto.timingSafeEqual(a,b);}

async function handler(req,res){
  try{
    const rawUrl=String(req.url||"/"), original=String(req.headers?.["x-original-url"]||req.headers?.["x-vercel-original-url"]||req.headers?.["x-forwarded-uri"]||rawUrl), url=new URL(original,origin(req)); let p=url.pathname.replace(/^\/api(?:\/index\.js)?/,"")||"/"; p=p.replace(/\/+$/,"")||"/";
    if(p==="/auth/github"&&req.method==="GET")return oauthStart(req,res);
    if(p==="/auth/github/connect"&&req.method==="GET"){
      const s=session(req);if(!s)return redirect(res,"/");
      const state=b64(crypto.randomBytes(32)),redirectUri=process.env.GITHUB_REDIRECT_URI||`${origin(req)}/api/auth/github/callback`;
      await rememberOAuthState(state,redirectUri,{provider:"github-link",userId:String(s.id),googleSub:String(s.googleSub||""),email:String(s.email||""),emailVerified:s.emailVerified!==false});
      const u=new URL("https://github.com/login/oauth/authorize");u.searchParams.set("client_id",process.env.GITHUB_CLIENT_ID||"");u.searchParams.set("redirect_uri",redirectUri);u.searchParams.set("scope","read:user repo workflow delete_repo");u.searchParams.set("state",state);
      res.setHeader("Set-Cookie",`wydev_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`);return redirect(res,u.toString());
    }
    if(p==="/auth/github/callback"&&req.method==="GET")return oauthCallback(req,res);
    if(p==="/auth/google/login"&&req.method==="GET")return googleLoginStart(req,res);
    if(p==="/auth/google"&&req.method==="GET")return googleDriveStart(req,res);
    if(p==="/auth/google/callback"&&req.method==="GET")return googleDriveCallback(req,res);
    if(p==="/auth/google/status"&&req.method==="GET")return googleDriveStatus(req,res);
    if(p==="/auth/google/disconnect"&&req.method==="POST")return googleDriveDisconnect(req,res);
    if(p==="/auth/me"&&req.method==="GET"){const s=session(req);return json(res,200,s?{user:{id:s.id,login:s.login||"",name:s.name,avatar:s.avatar,email:s.email||null,provider:s.provider||"github",githubConnected:!!s.token&&!!s.login,googleConnected:!!s.googleSub}}:{user:null});}
    if(p==="/auth/logout"&&req.method==="POST"){clearSession(res);return json(res,200,{ok:true});}

    if(p==="/notifications/config"&&req.method==="GET") return json(res,200,await publicFirebaseConfig());
    if(p==="/notifications/subscribe"&&req.method==="POST") { const u=requireSession(req,res); if(!u)return; const b=await body(req); const token=String(b.token||"").trim(); if(!token)return json(res,400,{error:"Push token required"}); await savePushToken(u,token,b.timezone); return json(res,200,{ok:true}); }
    if(p==="/notifications/unsubscribe"&&req.method==="POST") { const u=requireSession(req,res); if(!u)return; const b=await body(req); await removePushToken(u,String(b.token||"")); return json(res,200,{ok:true}); }
    if(p==="/notifications/build-failed"&&req.method==="POST") {
      const auth=String(req.headers.authorization||""); const token=auth.startsWith("Bearer ")?auth.slice(7):""; if(!token)return json(res,401,{error:"GitHub workflow token required"});
      const b=await body(req),repository=String(b.repository||"").trim(),runId=String(b.runId||"").trim(); if(!repository)return json(res,400,{error:"Repository required"});
      const repo=await gh(token,`/repos/${repository}`); const ownerLogin=repo?.owner?.login; if(!ownerLogin)return json(res,404,{error:"Repository owner not found"});
      if(String(repo.full_name||"").toLowerCase()!==repository.toLowerCase())return json(res,403,{error:"Repository mismatch"});
      if(db){const snap=await db.collection("wydev_fcm_tokens").where("login","==",String(ownerLogin)).where("enabled","==",true).limit(100).get(); const ids=[...new Set(snap.docs.map(d=>String(d.data().userId)))]; for(const uid of ids) await sendPushToUser(uid,"Build failed ❌",`${repository} has a failed GitHub Actions build. Open WyteLab to inspect the run.`,{type:"build_failed",repository,runId});}
      return json(res,200,{ok:true});
    }
    // Machine-to-machine billing endpoints must authenticate with their own
    // Flutterwave/cron credentials before the normal GitHub session gate.
    // Flutterwave webhooks and Vercel cron requests do not carry a user cookie.
    if(p==="/billing/webhook"&&req.method==="POST"){
      let raw="";for await(const c of req)raw+=c;
      if(!validWebhook(req,raw))return json(res,401,{error:"Invalid Flutterwave signature"});
      let data;try{data=JSON.parse(raw)}catch{return json(res,400,{error:"Invalid JSON"})}
      const tx=data.data||{};
      if(tx.id){
        try{
          const d=await flw(`/charges/${encodeURIComponent(tx.id)}`),x=d.data||{};
          const ref=String(x.reference||tx.reference||"").trim();
          const rec=ref?await getTransaction(ref):null;
          if(rec&&String(rec.chargeId||tx.id)===String(tx.id)&&ref===String(rec.reference||ref)){
            if(String(rec.status||"").toLowerCase()==="succeeded") return json(res,200,{received:true,duplicate:true});
            await setTransaction(ref,{status:x.status||"pending",chargeId:tx.id,updatedAt:Date.now()});
            if(x.status==="succeeded"&&String(x.reference||"")===ref&&Number(x.amount)===Number(rec.amount)&&String(x.currency)===String(rec.currency)){
              const existing=await getEntitlement(rec.userId);
              const base=rec.renewal?Math.max(Date.now(),Number(existing?.expiresAt)||0):Date.now();
              const expiresAt=addOneMonth(base);
              await setEntitlement(rec.userId,{status:"active",expiresAt,renewAt:expiresAt,reference:ref,customerId:rec.customerId,paymentMethodId:rec.paymentMethodId,currency:rec.currency,updatedAt:Date.now(),renewalPending:false});
              try{await sendPushOnce(rec.userId,`pro-unlocked:${ref}`,rec.renewal?"WyteLab Pro renewed 🎉":"WyteLab Pro unlocked 🎉",rec.renewal?"Your Pro subscription was renewed successfully.":"Your Pro subscription is active.",{type:rec.renewal?"pro_renewed":"pro_unlocked"})}catch{}
            } else if(rec.renewal&&["failed","cancelled","canceled","voided"].includes(String(x.status||"").toLowerCase())){
              await setEntitlement(rec.userId,{status:"past_due",renewalPending:false,lastRenewalReference:ref,updatedAt:Date.now()});
            }
          }
        }catch{}
      }
      return json(res,200,{received:true});
    }
    if(p==="/billing/renew"&&(req.method==="GET"||req.method==="POST")){
      const auth=req.headers.authorization||"";
      if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`)return json(res,401,{error:"Unauthorized"});
      return json(res,200,{processed:await renewDue(),notifications:await runScheduledNotifications()});
    }

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
    if(p==="/billing/authorize"&&req.method==="POST"){const b=await body(req);return json(res,200,await authorizeCharge(s,b.id,b.authorization,b.reference));}
    if(p==="/billing/cancel"&&req.method==="POST"){return json(res,200,await cancelSubscription(s));}
    if(p==="/github/repos"&&req.method==="GET"){
      const snapshot=await getRepoSnapshot(s.id);
      try{
        const all=await gh(s.token,"/user/repos?per_page=100&sort=updated");
        const plan=await entitlement(s);
        const limit=plan==="pro"?null:Number(process.env.FREE_REPO_LIMIT||10);
        const repos=limit!=null?all.slice(0,limit):all;
        if(!repos.length && snapshot?.repos?.length){
          // Confirm an empty GitHub result before accepting it. This protects
          // against a transient/rate-limit/background-tab response while still
          // allowing a genuinely empty GitHub account to clear its snapshot.
          try{
            await new Promise(r=>setTimeout(r,350));
            const confirm=await gh(s.token,"/user/repos?per_page=100&sort=updated");
            if(confirm.length){
              const confirmed=limit!=null?confirm.slice(0,limit):confirm;
              const result={repos:confirmed,total:confirm.length,limit,plan};
              await saveRepoSnapshot(s.id,result);
              return json(res,200,result);
            }
            await saveRepoSnapshot(s.id,{repos:[],total:0,limit,plan});
            return json(res,200,{repos:[],total:0,limit,plan});
          }catch{
            return json(res,200,{repos:snapshot.repos,total:snapshot.total,limit:snapshot.limit??limit,plan:snapshot.plan||plan,stale:true,savedAt:snapshot.savedAt||0});
          }
        }
        const result={repos,total:all.length,limit,plan};
        await saveRepoSnapshot(s.id,result);
        return json(res,200,result);
      }catch(e){
        if(Number(e?.status)===401) throw e;
        if(snapshot?.repos?.length){
          return json(res,200,{repos:snapshot.repos,total:snapshot.total,limit:snapshot.limit??null,plan:snapshot.plan||"free",stale:true,savedAt:snapshot.savedAt||0});
        }
        throw e;
      }
    }
    if(p==="/github/repos"&&req.method==="POST"){
      const b=await body(req);
      const name=String(b.name||"").trim();
      if(!/^[A-Za-z0-9._-]{1,100}$/.test(name))return json(res,400,{error:"Repository name may only contain letters, numbers, dots, dashes and underscores.",code:"INVALID_REPO_NAME"});
      const operationId=String(b.operationId||"").trim();
      if(operationId && !/^[A-Za-z0-9_-]{12,120}$/.test(operationId))return json(res,400,{error:"Invalid repository creation operation id.",code:"INVALID_OPERATION_ID"});

      // If the APK retries after losing the response, first check whether GitHub
      // already created the requested repository. This makes creation safe across
      // WebView suspension, radio handoffs and lost HTTP responses.
      const owner=String(s.login||"").trim();
      if(operationId){
        const prior=await getRepoCreateOperation(s.id,operationId);
        if(prior?.status==="completed"&&prior.repo?.id)return json(res,200,{...prior.repo,recovered:true,idempotent:true});
      }
      const already=await recoverCreatedRepo(s.token,owner,name);
      if(already){
        if(operationId)await saveRepoCreateOperation(s.id,operationId,{status:"completed",repo:already,recovered:true});
        return json(res,200,{...already,recovered:true});
      }

      const plan=await entitlement(s);
      if(plan!=="pro"){
        const limit=Number(process.env.FREE_REPO_LIMIT||10);
        const snapshot=await getRepoSnapshot(s.id);
        // Prefer a recent local/server snapshot to avoid a slow extra GitHub call.
        // If there is no trustworthy snapshot, perform one bounded owner-only list.
        let total=Number(snapshot?.total||0);
        const fresh=Number(snapshot?.savedAt||0)>Date.now()-5*60*1000;
        if(!fresh){
          const existing=await gh(s.token,"/user/repos?affiliation=owner&per_page=100",{timeoutMs:30000});
          total=existing.length;
          const nextLimit=limit;
          await saveRepoSnapshot(s.id,{repos:nextLimit==null?existing:existing.slice(0,nextLimit),total,limit:nextLimit,plan});
        }
        if(total>=limit)return json(res,403,{error:`Free plan is limited to ${limit} repositories. Upgrade to WyteLab Pro for unlimited repositories.`,code:"REPO_LIMIT",limit,total});
      }

      const payload={name,private:!!b.private,auto_init:true};
      if(b.description)payload.description=String(b.description).slice(0,350);
      if(b.license_template){
        const lt=String(b.license_template).trim().toLowerCase();
        const KNOWN_LICENSES=new Set(["mit","apache-2.0","gpl-3.0","gpl-2.0","lgpl-3.0","lgpl-2.1","agpl-3.0","bsd-2-clause","bsd-3-clause","mpl-2.0","epl-2.0","unlicense","cc0-1.0","bsl-1.0"]);
        if(KNOWN_LICENSES.has(lt))payload.license_template=lt;
      }
      if(operationId)await saveRepoCreateOperation(s.id,operationId,{status:"creating",name,owner,startedAt:Date.now()});

      let created;
      try{
        created=await gh(s.token,"/user/repos",{method:"POST",body:JSON.stringify(payload),timeoutMs:90000});
      }catch(e){
        // Never blindly repeat POST /user/repos. The first request may have succeeded
        // even though the APK/server lost the response. Verify the authoritative resource.
        if(isAmbiguousCreateError(e)){
          const recovered=await recoverCreatedRepo(s.token,owner,name);
          if(recovered){
            if(operationId)await saveRepoCreateOperation(s.id,operationId,{status:"completed",repo:recovered,recovered:true});
            return json(res,200,{...recovered,recovered:true});
          }
        }
        if(e.status===422){
          const recovered=await recoverCreatedRepo(s.token,owner,name);
          if(recovered){
            if(operationId)await saveRepoCreateOperation(s.id,operationId,{status:"completed",repo:recovered,recovered:true});
            return json(res,200,{...recovered,recovered:true});
          }
        }
        if(e.status===403||e.status===429){
          const wait=Math.max(0,Number(e.retryAfter||0));
          return json(res,e.status,{error:wait?`GitHub is rate limiting this request. Please wait ${wait} seconds before trying again.`:String(e.message||"GitHub denied the request."),code:e.code||"GITHUB_RATE_LIMIT",retryAfter:wait});
        }
        if(operationId)await saveRepoCreateOperation(s.id,operationId,{status:"unknown",name,owner,error:e.message,code:e.code});
        throw e;
      }

      if(operationId)await saveRepoCreateOperation(s.id,operationId,{status:"completed",repo:created});
      const snapshot=await getRepoSnapshot(s.id);
      if(snapshot){
        const nextLimit=plan==="pro"?null:Number(process.env.FREE_REPO_LIMIT||10);
        const nextRepos=[created,...(snapshot.repos||[]).filter(x=>x.id!==created.id)];
        const total=Number(snapshot.total||0)+1;
        await saveRepoSnapshot(s.id,{repos:nextLimit==null?nextRepos:nextRepos.slice(0,nextLimit),total,limit:nextLimit,plan});
        if(plan!=="pro"&&total>=8){try{await sendPushOnce(s.id,`repo-limit:${total}:${new Date().toISOString().slice(0,10)}`,"Free repository limit is getting close",`You now have ${total} of ${Number(process.env.FREE_REPO_LIMIT||10)} free repositories.`,{type:"repo_limit",count:String(total)});}catch{}}
      }
      return json(res,201,created);
    }
    const lkm=p.match(/^\/github\/licenses\/([^/]+)$/);
    if(lkm&&req.method==="GET"){
      const plan=await entitlement(s);
      if(plan!=="pro")return json(res,402,{error:"Adding a license to an existing repository is a WyteLab Pro feature. Upgrade to unlock it.",code:"PRO_REQUIRED"});
      const key=decodeURIComponent(lkm[1]);
      const lic=await gh(s.token,`/licenses/${encodeURIComponent(key)}`);
      return json(res,200,{key:lic.key,name:lic.name,body:lic.body});
    }
    const drm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)$/);
    if(drm&&req.method==="DELETE"){
      const plan=await entitlement(s);
      if(plan!=="pro") return json(res,403,{error:"Delete repository is a WyteLab Pro feature.",code:"PRO_REQUIRED",plan});
      const owner=decodeURIComponent(drm[1]),repo=decodeURIComponent(drm[2]);
      if(!owner||!repo) return json(res,400,{error:"Repository owner and name are required."});
      const scope=String(s.scope||"");
      if(!scope || !scope.split(/[\s,]+/).includes("delete_repo")){
        return json(res,403,{error:"GitHub deletion permission is missing. Sign out and authorize WyteLab again so GitHub can grant delete_repo permission.",code:"GITHUB_DELETE_SCOPE_MISSING"});
      }
      await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,{method:"DELETE"});
      try{
        const snapshot=await getRepoSnapshot(s.id);
        if(snapshot?.repos){
          const next=snapshot.repos.filter(x=>String(x.full_name||`${x.owner?.login||x.owner?.login||""}/${x.name||""}`).toLowerCase()!==`${owner}/${repo}`.toLowerCase());
          await saveRepoSnapshot(s.id,{...snapshot,repos:next,total:Math.max(0,Number(snapshot.total||next.length)-1)});
        }
      }catch{}
      return json(res,200,{ok:true,owner,repo});
    }
    const bm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/branches$/);
    if(bm&&req.method==="POST"){const owner=decodeURIComponent(bm[1]),repo=decodeURIComponent(bm[2]),b=await body(req);const name=String(b.name||"").trim();const from=String(b.from||"").trim();if(!/^[A-Za-z0-9._\/-]{1,120}$/.test(name)||name.startsWith("-")||name.endsWith("/"))return json(res,400,{error:"Invalid branch name"});const ref=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(from)}`);const created=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,{method:"POST",body:JSON.stringify({ref:`refs/heads/${name}`,sha:ref.object.sha})});return json(res,201,{name,sha:created.object.sha});}
    // Pull requests are free: the user's own GitHub token performs the operation.
    // Merging an existing pull request has its own path (…/pulls/:number/merge)
    // so it can never collide with the create/list route below, which used to
    // sit at the exact same "/pulls" path as the GitHub Hub's merge action and
    // silently swallowed it (see fix notes at this block).
    const prMerge=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/merge$/);
    if(prMerge&&req.method==="POST"){
      const owner=decodeURIComponent(prMerge[1]),repo=decodeURIComponent(prMerge[2]),number=Number(prMerge[3]);
      const b=await body(req),method=String(b.method||"merge");
      const d=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/merge`,{method:"PUT",body:JSON.stringify({merge_method:["merge","squash","rebase"].includes(method)?method:"merge",commit_title:b.commit_title?String(b.commit_title).slice(0,200):undefined,commit_message:b.commit_message?String(b.commit_message).slice(0,5000):undefined})});
      return json(res,200,d);
    }
    const prm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/pulls$/);
    if(prm){
      const owner=decodeURIComponent(prm[1]),repo=decodeURIComponent(prm[2]);
      if(req.method==="GET"){
        // Two different callers share this route: Project.jsx wants every PR
        // (open+closed) as a raw array with no ?state, while the GitHub Hub
        // screen passes ?state=open|closed|all and expects {pulls:[...]}.
        // FIXED: this used to always ignore ?state and return the raw array,
        // which — combined with the merge collision above — left the Hub's
        // PR list permanently empty (reading a .pulls property off an array).
        const stateParam=url.searchParams.get("state");
        if(stateParam){
          const data=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${encodeURIComponent(stateParam)}&per_page=50`);
          return json(res,200,{pulls:Array.isArray(data)?data:[]});
        }
        return json(res,200,await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&per_page=30`));
      }
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
    // GitHub Actions Control Center. These endpoints keep the user's GitHub
    // token server-side and turn common Actions chores into quick mobile-
    // friendly operations. Reading, inspection, dispatch and cancellation are
    // free; rerunning failed jobs is the paid Actions operation.
    const arm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/actions\/runs$/);
    if(arm&&req.method==="GET"){
      const owner=decodeURIComponent(arm[1]),repo=decodeURIComponent(arm[2]);
      const runs=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=25`);
      return json(res,200,{runs:Array.isArray(runs?.workflow_runs)?runs.workflow_runs:[],total:Number(runs?.total_count||0)});
    }
    const ajm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/actions\/runs\/([^/]+)\/jobs$/);
    if(ajm&&req.method==="GET"){
      const owner=decodeURIComponent(ajm[1]),repo=decodeURIComponent(ajm[2]),runId=decodeURIComponent(ajm[3]);
      const jobs=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=100`);
      return json(res,200,{jobs:Array.isArray(jobs?.jobs)?jobs.jobs:[]});
    }
    const arrm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/actions\/runs\/([^/]+)\/rerun-failed$/);
    if(arrm&&req.method==="POST"){
      const owner=decodeURIComponent(arrm[1]),repo=decodeURIComponent(arrm[2]),runId=decodeURIComponent(arrm[3]),b=await body(req);
      if(await entitlement(s)!=="pro")return json(res,402,{error:"Retrying a GitHub Actions workflow is a WyteLab Pro feature. Upgrade to Pro to rerun failed jobs.",code:"PRO_REQUIRED"});
      const path=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(runId)}/rerun-failed-jobs`;
      await gh(s.token,path,{method:"POST",body:JSON.stringify({enable_debug_logging:!!b.debug})});
      return json(res,201,{ok:true,debug:!!b.debug});
    }
    const acm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/actions\/runs\/([^/]+)\/(cancel|force-cancel)$/);
    if(acm&&req.method==="POST"){
      const owner=decodeURIComponent(acm[1]),repo=decodeURIComponent(acm[2]),runId=decodeURIComponent(acm[3]),action=acm[4];
      await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${encodeURIComponent(runId)}/${action}`,{method:"POST"});
      return json(res,202,{ok:true,action});
    }
    const awm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/actions\/workflows$/);
    if(awm&&req.method==="GET"){
      const owner=decodeURIComponent(awm[1]),repo=decodeURIComponent(awm[2]);
      const workflows=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows?per_page=100`);
      return json(res,200,{workflows:Array.isArray(workflows?.workflows)?workflows.workflows:[]});
    }
    const adm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/actions\/workflows\/([^/]+)\/dispatch$/);
    if(adm&&req.method==="POST"){
      const owner=decodeURIComponent(adm[1]),repo=decodeURIComponent(adm[2]),workflowId=decodeURIComponent(adm[3]),b=await body(req);
      const ref=String(b.ref||"").trim();
      if(!ref)return json(res,400,{error:"Choose a branch or tag to run the workflow."});
      const inputs=b.inputs&&typeof b.inputs==="object"&&!Array.isArray(b.inputs)?b.inputs:{};
      if(Object.keys(inputs).length>25)return json(res,400,{error:"GitHub allows at most 25 workflow inputs."});
      await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`,{method:"POST",body:JSON.stringify({ref,inputs})});
      return json(res,200,{ok:true});
    }
    // Mobile-friendly GitHub Hub: common issues/releases/PR/compare/star/fork
    // actions that otherwise require bouncing between multiple GitHub screens.
    const ghHub=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/(issues|releases|compare|star|fork)$/);
    if(ghHub){
      const owner=decodeURIComponent(ghHub[1]),repo=decodeURIComponent(ghHub[2]),kind=ghHub[3],base=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      if(kind==="issues"&&req.method==="GET"){
        const state=url.searchParams.get("state")||"open",data=await gh(s.token,`${base}/issues?state=${encodeURIComponent(state)}&per_page=50`);
        return json(res,200,{issues:(Array.isArray(data)?data:[]).filter(x=>!x.pull_request)});
      }
      if(kind==="issues"&&req.method==="POST"){
        const b=await body(req),title=String(b.title||"").trim(); if(!title)return json(res,400,{error:"Issue title is required"});
        const payload={title}; if(b.body)payload.body=String(b.body).slice(0,10000); if(Array.isArray(b.labels))payload.labels=b.labels.slice(0,20).map(String);
        return json(res,201,await gh(s.token,`${base}/issues`,{method:"POST",body:JSON.stringify(payload)}));
      }
      if(kind==="releases"&&req.method==="GET"){
        const data=await gh(s.token,`${base}/releases?per_page=30`); return json(res,200,{releases:Array.isArray(data)?data:[]});
      }
      if(kind==="releases"&&req.method==="POST"){
        const b=await body(req),tag=String(b.tag_name||"").trim(),name=String(b.name||tag).trim(); if(!tag)return json(res,400,{error:"Release tag is required"});
        return json(res,201,await gh(s.token,`${base}/releases`,{method:"POST",body:JSON.stringify({tag_name:tag,name,body:String(b.body||"").slice(0,10000),draft:!!b.draft,prerelease:!!b.prerelease,target_commitish:String(b.target_commitish||"").trim()||undefined})}));
      }
      if(kind==="compare"&&req.method==="GET"){
        const baseRef=String(url.searchParams.get("base")||"").trim(),headRef=String(url.searchParams.get("head")||"").trim();
        if(!baseRef||!headRef)return json(res,400,{error:"Base and head refs are required"});
        const data=await gh(s.token,`${base}/compare/${encodeURIComponent(baseRef)}...${encodeURIComponent(headRef)}`);
        return json(res,200,{status:data.status,ahead_by:data.ahead_by,behind_by:data.behind_by,total_commits:data.total_commits,files:(data.files||[]).slice(0,100).map(f=>({filename:f.filename,status:f.status,additions:f.additions,deletions:f.deletions,changes:f.changes})),html_url:data.html_url});
      }
      if(kind==="star"&&req.method==="GET"){
        try{await gh(s.token,`${base}/subscription`,{timeoutMs:10000});}catch{}
        const d=await fetch(`https://api.github.com/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,{headers:ghHeaders(s.token)}); return json(res,200,{starred:d.status===204});
      }
      if(kind==="star"&&(req.method==="PUT"||req.method==="DELETE")){
        const r=await fetch(`https://api.github.com/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,{method:req.method,headers:ghHeaders(s.token)});
        if(!r.ok)throw Object.assign(new Error(`GitHub star action failed (${r.status})`),{status:r.status});
        return json(res,200,{starred:req.method==="PUT"});
      }
      if(kind==="fork"&&req.method==="POST"){
        const d=await gh(s.token,`${base}/forks`,{method:"POST",body:JSON.stringify({name:String((await body(req)).name||"").trim()||undefined})});
        return json(res,202,{fork:d});
      }
    }
    const driveExport=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/drive-export$/);
    if(driveExport&&req.method==="POST"){
      const owner=decodeURIComponent(driveExport[1]),repo=decodeURIComponent(driveExport[2]),b=await body(req);
      const d=await exportRepoToDrive(s,owner,repo,String(b.branch||""));return json(res,200,{ok:true,file:d});
    }
    const safePath=(value)=>{const x=String(value||"").replaceAll("\\","/").replace(/^\/+/,"");const parts=x.split("/").filter(Boolean);if(!x||parts.some(v=>v===".."||v==="."))throw Object.assign(new Error("Invalid repository path."),{status:400});return parts.join("/")};
     const hasOAuthScope=(session,scope)=>String(session?.scope||"").split(/[ ,]+/).filter(Boolean).includes(scope);
     const isWorkflowPath=(path)=>String(path||"").replaceAll("\\","/").toLowerCase().startsWith(".github/workflows/");
    const binaryExt=new Set(["png","jpg","jpeg","gif","webp","ico","bmp","svgz","pdf","zip","gz","tar","7z","rar","woff","woff2","ttf","otf","eot","mp3","mp4","mov","avi","webm","wav","exe","dll","so","dylib","class","jar","psd","ai","sqlite","db"]);
    const isBinaryPath=(p)=>binaryExt.has(String(p).split(".").pop()?.toLowerCase()||"");
    const mimeForPath=(p)=>({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",ico:"image/x-icon",bmp:"image/bmp",svg:"image/svg+xml",pdf:"application/pdf",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",eot:"application/vnd.ms-fontobject",mp3:"audio/mpeg",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm",wav:"audio/wav"}[String(p).split(".").pop()?.toLowerCase()||""]||"application/octet-stream");
    const tm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/file-times$/);
    if(tm && req.method==="POST"){
      const owner=decodeURIComponent(tm[1]),repo=decodeURIComponent(tm[2]),b=await body(req);
      const branch=String(b.branch||"HEAD");
      const paths=Array.isArray(b.paths)?[...new Set(b.paths.map(x=>String(x||"").replaceAll("\\","/").replace(/^\/+/,"")).filter(Boolean))]:[];
      if(paths.length>2000)return json(res,413,{error:"Too many paths requested at once. Load timestamps in smaller batches."});
      const times={};
      let cursor=0;
      const worker=async()=>{
        while(cursor<paths.length){
          const path=paths[cursor++];
          try{
            const q=new URLSearchParams({path,sha:branch,per_page:"1"});
            const commits=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${q.toString()}`);
            const c=Array.isArray(commits)?commits[0]:null;
            const date=c?.commit?.author?.date||c?.commit?.committer?.date||null;
            if(date)times[path]=new Date(date).getTime();
          }catch(e){
            if(e.status===404) continue;
            if(e.status===409) continue;
            if(e.status===403 || e.status===429) throw e;
          }
        }
      };
      try{
        await Promise.all(Array.from({length:Math.min(8,Math.max(1,paths.length))},()=>worker()));
      }catch(e){
        return json(res,e.status||502,{error:e.status===403||e.status===429?"GitHub rate limit reached while loading file timestamps. File content remains available; timestamps will use the saved local values until the next refresh.":(e.message||"Unable to load file timestamps."),code:e.status===403||e.status===429?"TIMESTAMP_RATE_LIMIT":"TIMESTAMP_LOOKUP_FAILED",times});
      }
      return json(res,200,{times});
    }
    const m=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/(tree|file|branches)$/);
    if(m){
      const owner=decodeURIComponent(m[1]),repo=decodeURIComponent(m[2]),kind=m[3];
      if(kind==="branches")return json(res,200,await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`));
      if(kind==="file"){const path=safePath(url.searchParams.get("path")||"") ,branch=url.searchParams.get("branch")||"HEAD";const d=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`);if(Array.isArray(d))return json(res,400,{error:"The selected path is a directory, not a file."});if(isBinaryPath(path)){
        const size=Number(d.size||0), raw=String(d.content||"").replace(/\n/g,"");
        if(size>3*1024*1024) return json(res,200,{path,content:{__wydevBinary:true,base64:"",mime:mimeForPath(path),size,tooLarge:true,html_url:d.html_url||null},sha:d.sha,size,html_url:d.html_url||null});
        return json(res,200,{path,content:{__wydevBinary:true,base64:raw,mime:mimeForPath(path),size},sha:d.sha,size});
      }return json(res,200,{path,content:d.encoding==="base64"?Buffer.from(d.content.replace(/\n/g,""),"base64").toString("utf8"):d.content||"",sha:d.sha,size:d.size});}
      const branch=url.searchParams.get("branch")||"HEAD";
      try {
        const ref=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`);
        const commit=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${ref.object.sha}`);
        const tree=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${commit.tree.sha}?recursive=1`);
        return json(res,200,{branch,baseSha:ref.object.sha,treeSha:commit.tree.sha,files:(tree.tree||[]).filter(x=>x.type==="blob").map(x=>({path:x.path,sha:x.sha,size:x.size}))});
      } catch(e) {
        // A repository with zero commits (created without "Initialize with a
        // README") has no ref to read at all. Treat that as a valid, empty
        // workspace instead of surfacing a raw 404 — there's simply nothing
        // to list yet, and the first commit will create the branch.
        if(e.status===404){
          const remote=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
          return json(res,200,{branch:remote.default_branch||branch,baseSha:"",treeSha:"",files:[]});
        }
        throw e;
      }
    }
    const bm2=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/blob$/);
    if(bm2&&req.method==="POST"){
      const owner=decodeURIComponent(bm2[1]),repo=decodeURIComponent(bm2[2]),b=await body(req);
      const path=safePath(b.path);
      const encoding=b.encoding==="base64"?"base64":"utf-8";
      const content=String(b.content??"");
      if(!content && encoding==="base64") return json(res,400,{error:`Binary file ${path} has no data.`});
      // Keep individual requests safely below common serverless request limits.
      if(Buffer.byteLength(content,"utf8")>5_500_000) return json(res,413,{error:`File ${path} is too large for this upload path. Split it into smaller files.`});
      const blob=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,{method:"POST",body:JSON.stringify({content,encoding})});
      return json(res,201,{sha:blob.sha,path});
    }
    // Last N commits on a branch, used to power the "Revert" picker. GitHub
    // 404s /commits entirely on a repository with zero commits yet — treat
    // that the same way the tree endpoint does above: an empty, valid list.
    const clm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/commits$/);
    if(clm&&req.method==="GET"){
      const owner=decodeURIComponent(clm[1]),repo=decodeURIComponent(clm[2]);
      const branch=url.searchParams.get("branch")||"";
      const perPage=Math.min(Math.max(Number(url.searchParams.get("limit"))||10,1),30);
      const qs=new URLSearchParams({per_page:String(perPage)});
      if(branch) qs.set("sha",branch);
      try{
        const commits=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${qs.toString()}`);
        return json(res,200,{commits:(commits||[]).map(c=>({
          sha:c.sha,
          message:c.commit?.message||"",
          author:c.commit?.author?.name||c.author?.login||"Unknown",
          date:c.commit?.author?.date||null,
          html_url:c.html_url
        }))});
      }catch(e){
        if(e.status===404||e.status===409) return json(res,200,{commits:[]});
        throw e;
      }
    }
    // Restores a branch to exactly the tree it had at an earlier commit,
    // without rewriting history: it builds a brand-new commit whose tree
    // matches the target commit and whose parent is the branch's current
    // tip, then fast-forwards the branch onto it (same non-force PATCH used
    // by the normal commit flow, so a concurrent push is never clobbered).
    const rvm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/revert$/);
    if(rvm&&req.method==="POST"){
      const owner=decodeURIComponent(rvm[1]),repo=decodeURIComponent(rvm[2]),b=await body(req);
      const plan=await entitlement(s);
      if(plan!=="pro")return json(res,402,{error:"Reverting to a previous commit is a WyteLab Pro feature. Upgrade to unlock it.",code:"PRO_REQUIRED"});
      const branch=String(b.branch||"").trim(), targetSha=String(b.sha||"").trim();
      if(!branch||!targetSha) return json(res,400,{error:"A branch and a commit to revert to are required"});
      const encodedOwner=encodeURIComponent(owner),encodedRepo=encodeURIComponent(repo);
      const refPath=(name)=>`/repos/${encodedOwner}/${encodedRepo}/git/ref/heads/${encodeURIComponent(name)}`;
      const updateRefPath=(name)=>`/repos/${encodedOwner}/${encodedRepo}/git/refs/heads/${encodeURIComponent(name)}`;
      let ref;
      try{ ref=await gh(s.token,refPath(branch)); }
      catch(e){ if(e.status===404) return json(res,404,{error:`Branch "${branch}" could not be found.`,code:"BRANCH_NOT_FOUND"}); throw e; }
      const currentSha=String(ref.object.sha||"");
      if(currentSha===targetSha) return json(res,400,{error:"The repository is already at that commit."});
      let targetCommit;
      try{ targetCommit=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/commits/${encodeURIComponent(targetSha)}`); }
      catch(e){ if(e.status===404) return json(res,404,{error:"That commit could not be found on GitHub."}); throw e; }
      // Reverting can reintroduce or remove workflow files, which needs the
      // same elevated OAuth scope the normal commit path requires.
      const currentCommit=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/commits/${currentSha}`);
      const [targetTree,currentTree]=await Promise.all([
        readTreeOrEmpty(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/trees/${targetCommit.tree.sha}?recursive=1`),
        readTreeOrEmpty(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/trees/${currentCommit.tree.sha}?recursive=1`)
      ]);
      const touchesWorkflow=[...(targetTree.tree||[]),...(currentTree.tree||[])].some(x=>x.type==="blob"&&isWorkflowPath(x.path));
      if(touchesWorkflow&&!hasOAuthScope(s,"workflow")) return json(res,403,{error:"GitHub requires the workflow permission to revert changes touching .github/workflows/. Sign out and sign in again so WyteLab can request the GitHub Actions workflow permission.",code:"GITHUB_WORKFLOW_SCOPE_REQUIRED"});
      const shortMsg=String(targetCommit.message||"").split("\n")[0].slice(0,72);
      const message=`Revert to ${targetSha.slice(0,7)}: ${shortMsg}`.slice(0,200);
      const commit=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/commits`,{method:"POST",body:JSON.stringify({message,tree:targetCommit.tree.sha,parents:[currentSha]})});
      try{
        await gh(s.token,updateRefPath(branch),{method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})});
      }catch(e){
        if(e.status===404) return json(res,409,{error:`Branch "${branch}" could not be found while reverting. Your history was not changed.`,code:"BRANCH_NOT_FOUND"});
        if(e.status===422||e.status===409) return json(res,409,{error:"GitHub changed the branch while reverting. Reload and try again.",code:"PUSH_RACE"});
        throw e;
      }
      return json(res,200,{ok:true,commitSha:commit.sha,revertedTo:targetSha,branch});
    }
    if(p==="/github/repos/commit"&&req.method==="POST"){const b=await body(req);return json(res,400,{error:"Use /github/repos/:owner/:repo/commit"});}
    const cm=p.match(/^\/github\/repos\/([^/]+)\/([^/]+)\/commit$/);
    if(cm&&req.method==="POST"){
      const owner=decodeURIComponent(cm[1]),repo=decodeURIComponent(cm[2]),b=await body(req); let branch=String(b.branch||"").trim(); const message=String(b.message||"").trim(),changes=Array.isArray(b.changes)?b.changes:[];
      if(!branch||!message||message.length>200)return json(res,400,{error:"A commit message (1-200 characters) is required"});
      if(changes.length>300)return json(res,413,{error:"Too many changed files in one push. Split the work into smaller commits."});
      // safePath both validates AND normalizes (strips leading slashes,
      // converts backslashes to forward slashes). The normalized value must
      // be written back onto each change, otherwise validation runs against
      // the cleaned path while the tree entries below still use the raw,
      // un-normalized one — so a path with a leading "/" or a Windows-style
      // "\" backslash would pass the check but still get sent to GitHub's
      // Trees API verbatim, creating a literally-named file instead of the
      // intended nested path.
      for(const c of changes) c.path=safePath(c.path);
      if(changes.some(c=>isWorkflowPath(c.path))&&!hasOAuthScope(s,"workflow")) return json(res,403,{error:"GitHub requires the workflow permission to add or update files under .github/workflows/. Sign out and sign in again so WyteLab can request the GitHub Actions workflow permission.",code:"GITHUB_WORKFLOW_SCOPE_REQUIRED"});
      let ref;
      let emptyRepo=false;
      const encodedOwner=encodeURIComponent(owner),encodedRepo=encodeURIComponent(repo);
      const refPath=(name)=>`/repos/${encodedOwner}/${encodedRepo}/git/ref/heads/${encodeURIComponent(name)}`;
      // GitHub's Git Database API splits this across two different paths:
      // reading a ref uses the singular "ref" (refPath above), but updating
      // one requires the plural "refs" — PATCHing the singular path 404s
      // even when the branch genuinely exists. Using refPath for the PATCH
      // below was the actual cause of "Branch could not be found while
      // pushing": every push would create the commit successfully, then
      // fail forever trying to move the branch pointer onto it.
      const updateRefPath=(name)=>`/repos/${encodedOwner}/${encodedRepo}/git/refs/heads/${encodeURIComponent(name)}`;
      // GitHub can briefly return 404 for refs immediately after repository
      // creation/branch operations (or just from read-replica lag on a busy
      // push), so a single failed GET/PATCH must never be reported as
      // "branch not found" on its own. Defined up front so every ref check
      // below — not just the final PATCH — benefits from the same retries.
      const readBranchRefWithRetry = async (name, attempts=7) => {
        let lastError;
        for(let attempt=0; attempt<attempts; attempt++){
          try { return await gh(s.token,refPath(name)); }
          catch(e){
            lastError=e;
            if(e.status!==404 || attempt===attempts-1) throw e;
            await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
          }
        }
        throw lastError;
      };
      const patchBranchWithRetry = async (name, expectedTip, newSha) => {
        let lastError;
        for(let attempt=0; attempt<5; attempt++){
          try {
            const live=await readBranchRefWithRetry(name,4);
            if(String(live.object?.sha||"")!==String(expectedTip||"")){
              return {race:true,remoteSha:live.object?.sha||""};
            }
            await gh(s.token,updateRefPath(name),{
              method:"PATCH",
              body:JSON.stringify({sha:newSha,force:false})
            });
            return {ok:true};
          } catch(e){
            lastError=e;
            if(e.status!==404 || attempt===4) throw e;
            await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));
          }
        }
        throw lastError;
      };
      try {
        ref=await gh(s.token,refPath(branch));
      } catch(e) {
        if(e.status===404){
          // A cached branch can disappear after a rename/deletion. Do not try
          // to manufacture a stale branch on every commit: use the repository
          // default branch, which is the branch GitHub itself treats as the
          // canonical target for normal repository writes.
          const remote=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}`);
          const liveBranch=String(remote.default_branch||"").trim();
          if(liveBranch){
            try {
              ref=await gh(s.token,refPath(liveBranch));
              branch=liveBranch;
            } catch(liveErr) {
              if(liveErr.status!==404) throw liveErr;
              // No default-branch ref means the repository has no commits yet.
              emptyRepo=true;
              branch=liveBranch;
            }
          } else {
            emptyRepo=true;
          }
        } else throw e;
      }
      const expectedSha=String(b.expectedSha||"").trim();
      const baseFiles=Array.isArray(b.baseFiles)?b.baseFiles:[];
      let initialSha=emptyRepo?"":String(ref.object.sha||"");
      let head=emptyRepo?null:await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/commits/${initialSha}`);

      // If the branch moved since WyteLab loaded the project, safely replay the
      // user's local changes on top of the newer remote tree. A conflict is
      // reported only when the same path was also changed remotely. Unrelated
      // remote commits therefore no longer cause a false "REMOTE CHANGES
      // DETECTED" block, while we still never overwrite another user's edit.
      if(!emptyRepo&&expectedSha&&initialSha!==expectedSha){
        const baseByPath=new Map(baseFiles.map(x=>[String(x?.path||""),String(x?.sha||"")]));
        const latestCommit=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/commits/${initialSha}`);
        const latestTree=await readTreeOrEmpty(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/trees/${latestCommit.tree.sha}?recursive=1`);
        const remoteByPath=new Map((latestTree.tree||[]).filter(x=>x.type==="blob").map(x=>[String(x.path),String(x.sha||"")]));
        const conflicts=[];
        for(const c of changes){
          const path=String(c.path||"");
          const before=baseByPath.get(path)||"";
          const remote=remoteByPath.get(path)||"";
          if(c.status==="A"){
            if(remote) conflicts.push(path);
          }else if(c.status==="D"){
            if(remote&&before&&remote!==before) conflicts.push(path);
          }else if(c.status==="M") {
            if(remote!==before) conflicts.push(path);
          }
        }
        if(conflicts.length){
          return json(res,409,{error:"GitHub changed the same files you changed. Review the conflicts before pushing.",code:"REMOTE_CONFLICT",remoteSha:initialSha,localSha:expectedSha,conflicts:conflicts.slice(0,50)});
        }
        head=latestCommit;
      }
      const entries=[];
      const uploads=[];
      for(const c of changes){
        if(!c.path) continue;
        // Nothing exists yet in an empty repository, so a "delete" entry has
        // nothing to remove — including it would just confuse the Trees API,
        // which has no base_tree to delete from.
        if(c.status==="D"){if(!emptyRepo)entries.push({path:c.path,mode:"100644",type:"blob",sha:null});continue}
        if(c.blobSha){entries.push({path:c.path,mode:"100644",type:"blob",sha:String(c.blobSha)});continue}
        const binary=c.content&&typeof c.content==="object"&&c.content.__wydevBinary===true;
        if(binary&&!c.content.base64)return json(res,400,{error:`Binary file ${c.path} has no data.`});
        uploads.push({c,binary});
      }
      // Backwards-compatible fallback for older clients that still send file
      // contents directly to the commit endpoint.
      const blobResults=await Promise.all(uploads.map(async ({c,binary})=>{
        const raw=binary?String(c.content.base64):String(c.content??"");
        if(Buffer.byteLength(raw,"utf8")>5_500_000) throw Object.assign(new Error(`File ${c.path} is too large for the commit request. Re-upload with the latest WyteLab version.`),{status:413});
        const blob=await gh(s.token,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,{method:"POST",body:JSON.stringify({content:raw,encoding:binary?"base64":"utf-8"})});
        return {path:c.path,mode:"100644",type:"blob",sha:blob.sha};
      }));
      entries.push(...blobResults);
      // Deleting every remaining file via base_tree + a full set of sha:null
      // entries is a known rough edge in GitHub's Trees API — it can reject
      // the request instead of producing the (perfectly valid) empty tree.
      // A commit that's 100% deletions always results in an empty tree
      // regardless of what base_tree held, so build that directly instead of
      // diffing against it.
      // Deleting every remaining file always results in git's canonical empty
      // tree. That object is a fixed constant that exists in every repository
      // — it doesn't need to be created — and GitHub's Trees API has rejected
      // both ways of asking it to build one explicitly here (an empty `tree`
      // array with no base_tree, and a base_tree diffed down to nothing).
      //
      // FIXED: that "both ways rejected it" note turned out to describe the
      // base_tree-diffed-to-nothing attempt only. The actual bug was
      // elsewhere: this used to skip tree creation and reference Git's
      // well-known empty-tree SHA (4b825dc642cb6eb9a060e54bf8d69288fbee4904)
      // directly, assuming that because the SHA is a universal constant it
      // must already "exist" in every repository. It doesn't — GitHub's Git
      // Data API scopes objects per repository, so a SHA that content-hashes
      // to the same value elsewhere still has to actually be created here
      // before anything can reference it. Referencing it unrequested is
      // exactly what produced "Not Found" when committing a delete-everything
      // change. GitHub's own docs confirm the fix: POST /git/trees with an
      // empty `tree` array and no `base_tree` creates a real empty-tree
      // object in this repo (returning that same well-known SHA), which can
      // then be safely used as a commit's tree.
      //
      // Only take this path when the local deletion set covers every file
      // that was actually loaded as the base. A single-file delete must be
      // applied on top of the existing tree; otherwise one deletion would
      // accidentally erase the whole repository.
      const basePaths=new Set(baseFiles.map(x=>String(x?.path||"")).filter(Boolean));
      const deletedPaths=new Set(changes.filter(c=>c.status==="D").map(c=>String(c.path||"")).filter(Boolean));
      const allLoadedFilesDeleted=!emptyRepo&&basePaths.size>0&&[...basePaths].every(path=>deletedPaths.has(path));
      const allDeletions=allLoadedFilesDeleted&&changes.every((c)=>c.status==="D");
      const treeSha=allDeletions
        ? (await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/trees`,{method:"POST",body:JSON.stringify({tree:[]})})).sha
        : (await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/trees`,{method:"POST",body:JSON.stringify(emptyRepo?{tree:entries}:{base_tree:head.tree.sha,tree:entries})})).sha;
      // Re-check the branch after blob creation and immediately before making
      // the tree/commit. ZIP uploads can take long enough for another GitHub
      // change to land while we are uploading blobs. Never build a commit on
      // top of a stale parent. This now shares the same retrying reader as the
      // final PATCH below, so a single transient 404 here can no longer abort
      // an otherwise-healthy push.
      if(!emptyRepo){
        try {
          const latest=await readBranchRefWithRetry(branch,5);
          if(String(latest.object?.sha||"")!==initialSha){
            return json(res,409,{error:"GitHub changed this branch while WyteLab was preparing your push. Your local changes were kept. Review or reload the latest repository state before pushing again.",code:"PUSH_RACE",remoteSha:latest.object?.sha||"",localSha:initialSha});
          }
        } catch(e){
          if(e.status===404)return json(res,409,{error:`Branch "${branch}" no longer exists on GitHub. Your local changes were kept. Refresh the repository and select an existing branch.`,code:"BRANCH_NOT_FOUND",branch});
          throw e;
        }
      }
      const commitBody=emptyRepo?{message,tree:treeSha}:{message,tree:treeSha,parents:[initialSha]};
      const commit=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/commits`,{method:"POST",body:JSON.stringify(commitBody)});
      // Publish the commit atomically against the branch tip we validated.
      try {
        if(emptyRepo){
          // A commit object can be created before the first branch exists.
          // Create the ref only after the commit has been created. If another
          // client wins the first-push race, never overwrite its branch.
          try {
            await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}/git/refs`,{
              method:"POST",
              body:JSON.stringify({ref:`refs/heads/${branch}`,sha:commit.sha})
            });
          } catch(e){
            if(e.status===422){
              const live=await readBranchRefWithRetry(branch,5);
              return json(res,409,{
                error:"Another commit was pushed to this repository while WyteLab was creating the first branch. Your local changes were kept and no force-push was performed.",
                code:"PUSH_RACE",
                remoteSha:live.object?.sha||"",
                localSha:""
              });
            }
            throw e;
          }
        } else {
          const result=await patchBranchWithRetry(branch,initialSha,commit.sha);
          if(result?.race){
            return json(res,409,{
              error:"GitHub changed this branch while WyteLab was committing. Your local changes were kept and no force-push was performed.",
              code:"PUSH_RACE",
              remoteSha:result.remoteSha,
              localSha:initialSha
            });
          }
        }
      } catch(e) {
        if(e.status===404){
          // Re-resolve the repository metadata before declaring the branch
          // genuinely missing. This also handles a renamed default branch.
          try {
            const remote=await gh(s.token,`/repos/${encodedOwner}/${encodedRepo}`);
            const liveBranch=String(remote.default_branch||"").trim();
            if(liveBranch && liveBranch!==branch){
              try {
                const live=await readBranchRefWithRetry(liveBranch,5);
                return json(res,409,{
                  error:`Branch "${branch}" no longer exists on GitHub. The repository now uses "${liveBranch}" as its default branch. Reload the repository to continue on the current branch.`,
                  code:"BRANCH_NOT_FOUND",
                  branch,
                  currentBranch:liveBranch,
                  remoteSha:live.object?.sha||""
                });
              } catch(liveErr) {
                if(liveErr.status!==404) throw liveErr;
              }
            }
            // The repository itself still reports this exact branch as its
            // default. GitHub would never report a nonexistent branch as the
            // default branch, so the preceding run of 404s was read-replica
            // lag, not a real deletion. Give the push one final, generously
            // retried attempt instead of discarding a healthy commit.
            if(liveBranch && liveBranch===branch){
              try {
                const retryResult=await patchBranchWithRetry(branch,initialSha,commit.sha);
                if(retryResult?.race){
                  return json(res,409,{
                    error:"GitHub changed this branch while WyteLab was committing. Your local changes were kept and no force-push was performed.",
                    code:"PUSH_RACE",
                    remoteSha:retryResult.remoteSha,
                    localSha:initialSha
                  });
                }
                return json(res,200,{ok:true,commitSha:commit.sha,html_url:commit.html_url,branch});
              } catch(retryErr) {
                if(retryErr.status!==404) throw retryErr;
              }
            }
          } catch(resolveErr) {
            console.warn("Branch re-resolution failed:",resolveErr.message);
          }
          return json(res,409,{
            error:`Branch "${branch}" could not be found while pushing. GitHub did not accept the ref update, so your local changes were kept. Reload the repository and try again.`,
            code:"BRANCH_NOT_FOUND",
            branch,
            details:e.data||null
          });
        }
        if(e.status===422 || e.status===409){
          return json(res,409,{
            error:"GitHub changed or rejected the branch during the push. Your local changes were kept and WyteLab did not force-push.",
            code:"PUSH_RACE",
            details:e.data||null
          });
        }
        throw e;
      }
      return json(res,200,{ok:true,commitSha:commit.sha,html_url:commit.html_url,branch});
    }
    if(p==="/ai/diagnose"&&req.method==="POST"){const b=await body(req);return json(res,200,await aiDiagnose(s,b));}
    if(p==="/ai/diagnose-repo"&&req.method==="POST"){const b=await body(req);return json(res,200,await aiDiagnoseRepo(s,b));}
    if(p==="/billing/status"&&req.method==="GET"){
      let recovered=null;
      if(db){try{recovered=await recoverEntitlement(s)}catch(e){console.warn("Billing recovery failed:",e.message)}}
      const e=await getEntitlement(s.id);
      return json(res,200,{plan:await entitlement(s),expiresAt:e?.expiresAt||null,renewAt:e?.renewAt||null,renewalPending:!!e?.renewalPending,recovered:!!recovered?.recovered});
    }
    if(p==="/billing/config"&&req.method==="GET")return json(res,200,{usd:Number(process.env.FLW_PRO_USD||7),ngn:Number(process.env.FLW_PRO_NGN||7500),environment:FLW_LIVE?"live":"sandbox",encryptionKey:process.env.FLW_ENCRYPTION_KEY||""});
    if(p==="/billing/verify"&&req.method==="POST"){const b=await body(req);if(!b.reference)return json(res,400,{error:"Transaction reference required"});return json(res,200,await verifyCharge(s,b.id,b.reference));}
    if(p==="/billing/recover"&&req.method==="POST"){const b=await body(req);return json(res,200,await recoverEntitlement(s,String(b.reference||"")));}
    if(p==="/billing/resolve"&&req.method==="POST"){
      const b=await body(req);const reference=String(b.reference||"").trim();if(!reference)return json(res,400,{error:"Transaction reference required"});
      const tx=await getTransaction(reference);if(!tx||String(tx.userId)!==String(s.id))return json(res,404,{error:"Payment transaction not found"});
      return json(res,200,await verifyCharge(s,tx.chargeId,reference));
    }
    if(p==="/billing/checkout"&&req.method==="POST"){const b=await body(req);b.req=req;const d=await createBillingCheckout(s,b);return json(res,200,d);}
    return json(res,404,{error:"Route not found"});
  }catch(e){return json(res,e.status||500,{error:e.message||"Server error",code:e.code,limit:e.limit,used:e.used,remaining:e.remaining,plan:e.plan});}
}
export default handler;
